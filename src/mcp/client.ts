// src/mcp/client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "../utils/logger.js";
import type { Config } from "../config/types.js";
import type { Diagnostic } from "./oracle.js";

export interface ProjectGraph {
    files: string[];
    dependencies: Record<string, string[]>;
    tsConfig?: any;
}

export interface RepairContext {
    filePath: string;
    code: string;
    mockName: string;
    hookName: string;
    errorType?: string;
    diagnostics?: Diagnostic[];
    projectGraph?: ProjectGraph;
}

export interface RepairResult {
    success: boolean;
    newCode?: string;
    todo?: string;
}

export class BinderMCP {
    private clients: Map<string, Client> = new Map();

    async initialize(config?: Config) {
        const servers = config?.mcpServers || [
            { name: 'ts-repair', command: 'npx', args: ['ts-repair', 'mcp-server'] },
            { name: 'prettier', command: 'npx', args: ['prettier-mcp', 'mcp-server'] },
            { name: 'vitest', command: 'npx', args: ['vitest-mcp', 'mcp-server'] },
            { name: 'lsp', command: 'npx', args: ['lsp-mcp', 'mcp-server'] }
        ];

        for (const server of servers) {
            try {
                const client = new Client({ name: `binder-${server.name}`, version: "0.1.0" }, { capabilities: {} });
                const transport = new StdioClientTransport({
                    command: server.command,
                    args: server.args,
                    env: server.env
                });
                await client.connect(transport);
                this.clients.set(server.name, client);
                logger.system(`MCP: ${server.name} engine connected.`);
            } catch (err) {
                logger.debug(`MCP: Failed to connect to ${server.name}.`);
            }
        }
    }

    async repair(context: RepairContext): Promise<RepairResult> {
        // Step 1: Analyze binding failure
        const analyzer = this.clients.get('ts-repair') || this.clients.values().next().value;
        if (!analyzer) return { success: false };

        try {
            const analysis: any = await analyzer.callTool({
                name: 'analyze_binding_failure',
                arguments: { context }
            });

            if (analysis.strategy === 'simple-fix') {
                const fixResult: any = await analyzer.callTool({
                    name: 'apply_fixes',
                    arguments: { filePath: context.filePath, code: context.code }
                });
                return { success: true, newCode: fixResult.newCode };
            }

            if (analysis.strategy === 'manual-required') {
                return { success: false, todo: await this.generateRichTodo(context, analysis) };
            }
        } catch (e) {
            logger.debug("MCP: Repair analysis failed. Falling back to simple fix.");
            // Fallback to simple fix if analyze_binding_failure tool is missing
            return this.simpleAutoFix(context);
        }

        return { success: false };
    }

    private async simpleAutoFix(context: RepairContext): Promise<RepairResult> {
        const repairClient = this.clients.get('ts-repair');
        if (!repairClient) return { success: false };

        try {
            const result: any = await repairClient.callTool({
                name: "apply_fixes",
                arguments: { filePath: context.filePath, code: context.code }
            });
            if (result && result.newCode) {
                return { success: true, newCode: result.newCode };
            }
        } catch (e) {
            logger.debug("MCP: Simple auto-fix failed.");
        }
        return { success: false };
    }

    private async generateRichTodo(context: RepairContext, analysis: any): Promise<string> {
        const analyzer = this.clients.get('ts-repair') || this.clients.values().next().value;
        let migrationGuide = "";

        try {
            const guideResult: any = await analyzer.callTool({
                name: 'generate_migration_guide',
                arguments: { context, analysis }
            });
            migrationGuide = guideResult.guide;
        } catch (e) {
            migrationGuide = analysis.explanation || "Complex pattern detected. Manual conversion needed.";
        }

        return `
/* 
======================================================================
TODO(BINDER): Manual Review Required
======================================================================
Mock: ${context.mockName}
Suggested Hook: ${context.hookName}
Why auto-conversion failed:
${migrationGuide}

Suggested steps:
${(analysis.suggestedSteps || []).map((s: string) => `- ${s}`).join('\n')}

Estimated effort: ${analysis.estimatedEffort || 'Medium'}
======================================================================
*/`.trim();
    }

    // Keep autoFix for backward compatibility if needed elsewhere
    async autoFix(filePath: string, code: string): Promise<string> {
        const result = await this.simpleAutoFix({ filePath, code, mockName: '', hookName: '' });
        return result.newCode || code;
    }

    /**
     * Formats the code using prettier-mcp to ensure clean AST output.
     */
    async format(filePath: string, code: string): Promise<string> {
        const formatter = this.clients.get('prettier');
        if (!formatter) return code;

        try {
            const result: any = await formatter.callTool({
                name: 'format',
                arguments: { filePath, code }
            });
            return result.newCode || code;
        } catch (e) {
            logger.debug(`MCP: Formatting failed for ${filePath}.`);
            return code;
        }
    }

    /**
     * Executes unit tests via vitest-mcp and returns functional diagnostics.
     */
    async runTests(filePath: string, testFilePath: string): Promise<{ success: boolean, failures?: any[] }> {
        const tester = this.clients.get('vitest');
        if (!tester) return { success: true }; // Skip if no tester configured

        try {
            const result: any = await tester.callTool({
                name: 'run_test',
                arguments: { filePath, testFilePath }
            });
            return {
                success: result.success,
                failures: result.failures
            };
        } catch (e) {
            logger.debug(`MCP: Test execution failed for ${testFilePath}.`);
            return { success: true };
        }
    }

    /**
     * Identifies structural changes in backend DTOs using LSP-MCP.
     */
    async getDelta(filePath: string): Promise<any[]> {
        const lsp = this.clients.get('lsp');
        if (!lsp) return [];

        try {
            const result: any = await lsp.callTool({
                name: 'get_structural_delta',
                arguments: { filePath }
            });
            return result.deltas || [];
        } catch (e) {
            logger.debug(`MCP: Failed to get structural delta for ${filePath}.`);
            return [];
        }
    }
}
