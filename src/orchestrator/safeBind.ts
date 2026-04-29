// src/orchestrator/safeBind.ts
import { Project, SyntaxKind } from 'ts-morph';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { safeRewrite } from '../rewrite/safeRewriter.js';
import { heuristicMatch } from '../match/heuristicMatcher.js';
import { semanticMatch } from '../match/semanticMatcher.js';
import { rewriteFile } from '../rewrite/astRewriter.js';
import { logger } from '../utils/logger.js';
import { runTypeCheck } from '../test/typeCheck.js';
import { getCachedBinding, saveBinding } from '../utils/cache.js';
import { BinderMCP } from '../mcp/client.js';
import type { MockFinding } from '../scan/mockScanner.js';
import type { Config } from '../config/types.js';
import type { BindingPlan } from '../common/types.js';

export async function safeBind(
  mocks: MockFinding[], 
  filePath: string, 
  config: Config,
  hookNames: string[]
) {
  const results = {
    auto: 0,
    todo: 0,
    skip: 0,
    todos: [] as Array<{mock: MockFinding, hook: string, reason: string, todoComment: string}>
  };

  const mcp = new BinderMCP();
  await mcp.initialize();

  const tsConfigPath = findNearestTsConfig(dirname(filePath));
  const project = new Project({
    tsConfigFilePath: tsConfigPath || undefined,
    skipAddingFilesFromTsConfig: !tsConfigPath,
    compilerOptions: { jsx: 4, allowJs: true, esModuleInterop: true }
  });
  
  const sourceFile = project.addSourceFileAtPath(filePath);
  const apiContent = readFileSync(join(config.frontend.generatedDir, "api.ts"), "utf-8");
  const originalCode = sourceFile.getFullText();
  
  for (const mock of mocks) {
    if (mock.type === 'msw_handler' || mock.type === 'mirage_handler') {
      results.todos.push({
        mock,
        hook: 'N/A',
        reason: 'Mock Server Handler detected',
        todoComment: `/* TODO(BINDER): Detects ${mock.type.replace('_', ' ').toUpperCase()}. 
Once the frontend components are bound to hooks, you should remove this handler from your mock server setup. */`
      });
      results.todo++;
      continue;
    }

    // 1. Check Cache First (Global Suggestion)
    const cached = getCachedBinding(filePath, mock.name);
    let hookName = (cached as any)?.hookName;
    let confidence = cached ? 1.0 : 0;

    if (!hookName) {
        // 2. Heuristic Match
        const hMatches = heuristicMatch([mock], hookNames, filePath);
        const hBest = hMatches[0];

        // 3. Semantic Match (Booster)
        const sMatches = semanticMatch([mock], hookNames.map(n => ({name: n, method: 'GET', path: '/', responseType: 'any'})), apiContent);
        const sBest = sMatches.find(m => m.mockName === mock.name);

        if (hBest && sBest && hBest.hookName === sBest.hookName) {
            hookName = hBest.hookName;
            confidence = Math.max(hBest.confidence, sBest.confidence, 0.9);
        } else if (hBest && hBest.confidence > 0.8) {
            hookName = hBest.hookName;
            confidence = hBest.confidence;
        }
    }
    
    if (!hookName || confidence < 0.5) {
      results.skip++;
      logger.debug(`Skipped: ${mock.name} (No confident hook match)`);
      continue;
    }
    
    // Check if safe to auto-convert
    const rewriteResult = safeRewrite(mock, hookName, sourceFile);
    
    switch(rewriteResult.type) {
      case 'auto':
        const plan: BindingPlan = {
          bindings: [{
            mockName: mock.name,
            hookName: hookName,
            confidence: confidence,
            actionType: 'READ',
            strategy: rewriteResult.strategy,
            loadingStrategy: config.frontend.loadingTemplate ? 'early-return-skeleton' : 'none',
            errorStrategy: config.frontend.errorTemplate ? 'early-return-error' : 'none'
          }],
          loadingTemplate: config.frontend.loadingTemplate,
          errorTemplate: config.frontend.errorTemplate
        };
        
        try {
          let rewritten = rewriteFile(filePath, plan, config.frontend.generatedDir);
          
          // --- MCP AUTONOMOUS REPAIR ---
          rewritten = await mcp.autoFix(filePath, rewritten);

          // --- COMPLIANCE CHECK ---
          logger.system(`  [Compliance] Validating rewrite for ${mock.name}...`);
          const check = runTypeCheck(filePath, rewritten, config.frontend.generatedDir);
          
          if (check.passed) {
            writeFileSync(filePath, rewritten);
            saveBinding(filePath, mock.name, { hookName });
            results.auto++;
            logger.success(`✓ Auto-converted: ${mock.name} → ${hookName}`);
          } else {
            logger.error(`❌ Rewrite for ${mock.name} failed type check. Reverting.`);
            check.errors.forEach(err => logger.system(`    - ${err}`));
            
            // Add as a TODO instead of breaking the file
            const todoComment = `/* TODO(BINDER): Auto-conversion failed type check. 
Error: ${check.errors[0]} 
Manual review required. */`;
            await insertTodoComment(sourceFile, mock, todoComment);
            sourceFile.saveSync();
            results.todo++;
          }
        } catch (e: any) {
          logger.error(`Failed to auto-convert ${mock.name}: ${e.message}`);
          results.skip++;
        }
        break;
        
      case 'todo':
        // Add TODO comment, leave mock untouched
        await insertTodoComment(sourceFile, mock, rewriteResult.todoComment!);
        sourceFile.saveSync();
        results.todo++;
        results.todos.push({
          mock,
          hook: hookName,
          reason: rewriteResult.reason || 'complex-pattern',
          todoComment: rewriteResult.todoComment!
        });
        logger.warn(`⚠️  TODO added: ${mock.name} (${rewriteResult.reason})`);
        break;
        
      case 'skip':
        results.skip++;
        logger.debug(`Skipped: ${mock.name} (${rewriteResult.reason})`);
        break;
    }
  }
  
  return results;
}

async function insertTodoComment(sourceFile: any, mock: MockFinding, comment: string) {
  const line = mock.line;
  // Find the node at the line
  const node = sourceFile.getDescendantAtPos(sourceFile.getStartOfLinePos(line));
  if (node) {
    const parent = node.getParentWhile(n => n.getStartLineNumber() === line) || node;
    parent.replaceWithText(`${comment}\n${parent.getText()}`);
  }
}

function findNearestTsConfig(startDir: string): string | null {
  let current = resolve(startDir);
  while (current !== dirname(current)) {
    const p = join(current, 'tsconfig.json');
    if (existsSync(p)) return p;
    current = dirname(current);
  }
  return null;
}
