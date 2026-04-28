import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "../utils/logger.js";
import { resolve, join } from "path";
import { existsSync } from "fs";

export interface Diagnostic {
    message: string;
    code?: string | number;
    file?: string;
    line?: number;
    character?: number;
}

export interface RepairResult {
    fixed: boolean;
    code?: string;
    appliedFixes: string[];
    remainingErrors: Diagnostic[];
    needsLLM: boolean;
    diagnosis?: string;
}

export class BinderMCPOracle {
    private repairClient: Client | null = null;
    private tsClient: Client | null = null;

    async initialize() {
        logger.system("Initializing MCP Oracle Layer (Invisible)...");
        
        try {
            // 1. Initialize ts-repair
            this.repairClient = new Client({ name: "binder-repair-client", version: "0.1.0" }, { capabilities: {} });
            const repairTransport = new StdioClientTransport({
                command: "npx",
                args: ["ts-repair", "mcp-server"]
            });
            await this.repairClient.connect(repairTransport);

            // 2. Initialize typescript-mcp
            this.tsClient = new Client({ name: "binder-ts-client", version: "0.1.0" }, { capabilities: {} });
            const tsTransport = new StdioClientTransport({
                command: "npx",
                args: ["typescript-mcp", "--stdio"]
            });
            await this.tsClient.connect(tsTransport);
            
            logger.success("MCP Oracle servers connected successfully.");
        } catch (err) {
            logger.warning(`Failed to initialize MCP Oracle: ${(err as Error).message}. Falling back to LLM-only repair.`);
            this.repairClient = null;
            this.tsClient = null;
        }
    }

    async orchestrateRepair(filePath: string, currentCode: string, diagnostics: Diagnostic[]): Promise<RepairResult> {
        if (!this.repairClient || !this.tsClient) {
            return { fixed: false, appliedFixes: [], remainingErrors: diagnostics, needsLLM: true };
        }

        let code = currentCode;
        let errors = diagnostics;
        let appliedFixes: string[] = [];
        
        // --- PHASE 0: MECHANICAL EXHAUSTION (Max 10 tries) ---
        // Fix imports, semicolons, and missing await before anything else.
        logger.info("  [Oracle] Phase 0: Exhausting mechanical repairs...");
        let mechanicalAttempts = 0;
        while (mechanicalAttempts < 10 && errors.length > 0) {
            const mechanical = await this.tryMechanicalRepair(filePath, code);
            if (mechanical.success && mechanical.newCode) {
                code = mechanical.newCode;
                appliedFixes.push(...mechanical.fixes);
                // In a production environment, we'd re-verify with the compiler here
                mechanicalAttempts++;
                continue;
            }
            break;
        }

        // --- PHASE 1: SEMANTIC SPEC-GUIDED REPAIR (Max 3 tries) ---
        let semanticAttempts = 0;
        while (semanticAttempts < 3 && errors.length > 0) {
            const semantic = await this.trySemanticRepair(filePath, code, errors);
            if (semantic.success && semantic.newCode) {
                code = semantic.newCode;
                appliedFixes.push(...semantic.fixes);
                semanticAttempts++;
                continue;
            }
            break;
        }

        return {
            fixed: errors.length === 0,
            code,
            appliedFixes,
            remainingErrors: errors,
            needsLLM: errors.length > 0,
            diagnosis: errors.length > 0 ? `Oracle resolved ${appliedFixes.length} issues but got stuck on: ${errors[0].message}` : undefined
        };
    }

    private async tryMechanicalRepair(file: string, code: string) {
        if (!this.repairClient) return { success: false, fixes: [] };

        try {
            // Call ts-repair tool
            const result = await this.repairClient.callTool("repair", {
                file,
                code,
                apply: true
            });
            
            const data = result as any;
            if (data.success && data.newCode) {
                return { success: true, newCode: data.newCode, fixes: data.appliedFixes || ["Mechanical import fix"] };
            }
        } catch (e) {
            logger.system(`  [Oracle] ts-repair tool call skipped: ${(e as Error).message}`);
        }
        return { success: false, fixes: [] };
    }

    private async trySemanticRepair(file: string, code: string, errors: Diagnostic[]) {
        if (!this.tsClient) return { success: false, fixes: [] };

        try {
            // Use typescript-mcp to understand and fix field renames
            const error = errors[0];
            const result = await this.tsClient.callTool("smart_rename", {
                file,
                line: error.line,
                character: error.character,
                message: error.message
            });

            const data = result as any;
            if (data.success && data.newCode) {
                return { success: true, newCode: data.newCode, fixes: [data.fixDescription || "Semantic field rename"] };
            }
        } catch (e) {
            logger.system(`  [Oracle] typescript-mcp tool call skipped: ${(e as Error).message}`);
        }
        return { success: false, fixes: [] };
    }
}
