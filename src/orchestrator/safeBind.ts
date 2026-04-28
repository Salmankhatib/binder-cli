// src/orchestrator/safeBind.ts
import { Project, SyntaxKind } from 'ts-morph';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { safeRewrite } from '../rewrite/safeRewriter.js';
import { heuristicMatch } from '../match/heuristicMatcher.js';
import { rewriteFile } from '../rewrite/astRewriter.js';
import { logger } from '../utils/logger.js';
import { runTypeCheck } from '../test/typeCheck.js';
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

  const tsConfigPath = findNearestTsConfig(dirname(filePath));
  const project = new Project({
    tsConfigFilePath: tsConfigPath || undefined,
    skipAddingFilesFromTsConfig: !tsConfigPath,
    compilerOptions: { jsx: 4, allowJs: true, esModuleInterop: true }
  });
  
  const sourceFile = project.addSourceFileAtPath(filePath);
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

    // First, find matching hook using heuristics
    const matches = heuristicMatch([mock], hookNames, filePath);
    const bestMatch = matches[0];
    
    if (!bestMatch || bestMatch.confidence < 0.5) {
      results.skip++;
      logger.debug(`Skipped: ${mock.name} (No confident hook match)`);
      continue;
    }

    const hookName = bestMatch.hookName;
    
    // Check if safe to auto-convert
    const rewriteResult = safeRewrite(mock, hookName, sourceFile);
    
    switch(rewriteResult.type) {
      case 'auto':
        const plan: BindingPlan = {
          bindings: [{
            mockName: mock.name,
            hookName: hookName,
            confidence: rewriteResult.confidence,
            actionType: 'READ'
          }]
        };
        
        try {
          const rewritten = rewriteFile(filePath, plan, config.frontend.generatedDir);
          
          // --- COMPLIANCE CHECK ---
          logger.system(`  [Compliance] Validating rewrite for ${mock.name}...`);
          const check = runTypeCheck(filePath, rewritten, config.frontend.generatedDir);
          
          if (check.passed) {
            writeFileSync(filePath, rewritten);
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
