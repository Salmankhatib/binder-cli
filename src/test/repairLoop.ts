import { logger } from '../utils/logger.js';
import { runTypeCheck } from './typeCheck.js';
import { applyDeterministicFixes } from './deterministicFixes.js';
import { applySurgicalOrders } from '../rewrite/surgicalOrders.js';
import { callLLM } from '../ai/llmClient.js';
import { generateContext } from '../utils/contextManager.js';
import { recordSuccess, getGlobalRules, recordRule } from '../utils/cache.js';
import { BinderMCPClient } from '../utils/mcpClient.js';
import { resolve } from 'path';
import type { MockFinding } from '../scan/mockScanner.js';
import type { Config } from '../config/types.js';

export async function testAndRepair(
  filePath: string,
  initialCode: string,
  originalMocks: MockFinding[],
  config: Config,
  withIntegration: boolean = false
): Promise<string> {
  let currentCode = initialCode;
  const RETRY_LIMIT = 5; 
  let totalRetries = 0;

  // 1. Initialize MCP Client (Ready to Ask)
  const mcp = new BinderMCPClient();
  if (config.mcpServers) {
      await mcp.connect(config.mcpServers);
  }

  while (totalRetries < RETRY_LIMIT) {
    const typeResult = runTypeCheck(filePath, currentCode, config.frontend.generatedDir);
    if (typeResult.passed) {
      logger.success("✔ BINDING VERIFIED: 0 Compiler Errors.");
      recordSuccess(filePath, currentCode);
      return currentCode;
    }

    const error = typeResult.errors[0];
    logger.error(`[Compiler] ${error}`);

    const fixed = applyDeterministicFixes(currentCode, [{ code: 'TS', message: error, line: 0 }]);
    if (fixed !== currentCode) {
      currentCode = fixed;
      continue;
    }

    totalRetries++;
    const context = generateContext(config.frontend.generatedDir, filePath);
    const learnedRules = getGlobalRules();
    
    // Check for available MCP tools
    const mcpTools = await mcp.listTools();
    const toolsContext = mcpTools.length > 0 
        ? `### AVAILABLE MCP RESEARCH TOOLS:\n${JSON.stringify(mcpTools, null, 2)}`
        : "No external research tools available.";

    logger.system("  [Architect] Planning surgical fix with agentic discovery...");
    const architectPrompt = `
      YOU ARE THE LEAD ARCHITECT. Fix this TypeScript error: "${error}"
      
      REPO MAP: ${context}
      MEMORY: ${learnedRules}
      CODE: ${currentCode}
      ${toolsContext}

      TASK: Provide JSON Surgical Orders.
      
      AGENTIC CAPABILITY:
      If you lack information to solve the error, you can emit a REQUEST to use a tool.
      Example REQUEST format: "REQUEST: serverName.toolName({ arg: 'val' })"
      Binder will execute the tool and provide the results in the next turn.

      JSON FORMAT: { "orders": [...] }
    `;

    try {
      const response = await callLLM(architectPrompt, config.llm);
      
      // 2. Handle Agentic Tool Request
      if (response.includes("REQUEST:")) {
          const match = response.match(/REQUEST:\s*(\w+)\.(\w+)\(([\s\S]*?)\)/);
          if (match) {
              const [_, server, tool, argsStr] = match;
              logger.info(`  [Agentic] AI requested tool: ${server}.${tool}`);
              try {
                const args = JSON.parse(argsStr);
                const toolResult = await mcp.callTool(server, tool, args);
                
                const followUpPrompt = `TOOL RESULT from ${server}.${tool}:\n${JSON.stringify(toolResult)}\nNow, provide the Surgical Orders to fix: "${error}"`;
                const finalResponse = await callLLM(followUpPrompt, config.llm);
                const jsonMatch = finalResponse.match(/(\{[\s\S]*\})/);
                const orders = jsonMatch ? JSON.parse(jsonMatch[1]).orders : null;
                if (orders) currentCode = applySurgicalOrders(currentCode, orders);
                continue;
              } catch (e) {
                logger.error(`  [Agentic] Tool call failed: ${(e as Error).message}`);
              }
          }
      }

      const jsonMatch = response.match(/(\{[\s\S]*\})/);
      const orders = jsonMatch ? JSON.parse(jsonMatch[1]).orders : null;
      
      if (orders && orders.length > 0) {
          orders.forEach((o: any) => { if (o.type === 'RENAME_FIELD') recordRule(o.payload.old, o.payload.new); });
          currentCode = applySurgicalOrders(currentCode, orders);
      } else { break; }
    } catch (e) { break; }
  }

  logger.error("\n✖ BINDER COULD NOT BIND AUTOMATICALLY");
  throw new Error("Repair cycle exhausted.");
}