import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "./logger.js";

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
}

export class BinderMCPClient {
  private clients: Map<string, Client> = new Map();

  async connect(servers: MCPServerConfig[]) {
    for (const server of servers) {
      try {
        const transport = new StdioClientTransport({
          command: server.command,
          args: server.args,
        });

        const client = new Client(
          { name: "binder-client", version: "0.1.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        this.clients.set(server.name, client);
        logger.success(`[MCP] Connected to ${server.name}`);
      } catch (err) {
        logger.error(`[MCP] Failed to connect to ${server.name}: ${(err as Error).message}`);
      }
    }
  }

  async callTool(serverName: string, toolName: string, args: any) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP Server ${serverName} not connected`);
    
    return await client.callTool({
      name: toolName,
      arguments: args
    });
  }

  async listTools() {
    const allTools: any[] = [];
    for (const [name, client] of this.clients.entries()) {
      const tools = await client.listTools();
      allTools.push({ server: name, tools: tools.tools });
    }
    return allTools;
  }

  async disconnect() {
    for (const client of this.clients.values()) {
        // Disconnect logic if needed
    }
  }
}
