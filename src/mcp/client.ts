// src/mcp/client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "../utils/logger.js";

export class BinderMCP {
    private repairClient: Client | null = null;

    async initialize() {
        try {
            this.repairClient = new Client({ name: "binder-repair", version: "0.1.0" }, { capabilities: {} });
            const transport = new StdioClientTransport({
                command: "npx",
                args: ["ts-repair", "mcp-server"]
            });
            await this.repairClient.connect(transport);
            logger.system("MCP: ts-repair engine connected.");
        } catch (err) {
            logger.debug("MCP: ts-repair not available. Skipping auto-repairs.");
            this.repairClient = null;
        }
    }

    async autoFix(filePath: string, code: string): Promise<string> {
        if (!this.repairClient) return code;
        
        try {
            // ts-repair usually has a 'fix' or 'apply' tool
            const result = await this.repairClient.callTool({
                name: "apply_fixes",
                arguments: { filePath, code }
            });
            
            if (result && (result as any).newCode) {
                logger.success("  [MCP] Autonomous repair applied (imports/syntax).");
                return (result as any).newCode;
            }
        } catch (e) {
            logger.debug("MCP: Auto-fix failed.");
        }
        return code;
    }
}
