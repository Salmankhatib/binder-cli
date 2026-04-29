// src/orchestrator/safeBind.ts
import { Project, SyntaxKind } from 'ts-morph';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { safeRewrite } from '../rewrite/safeRewriter.js';
import { heuristicMatch } from '../match/heuristicMatcher.js';
import { semanticMatch } from '../match/semanticMatcher.js';
import { contextualMatch } from '../match/contextualMatcher.js';
import { rewriteFile } from '../rewrite/astRewriter.js';
import { logger } from '../utils/logger.js';
import { runTypeCheck } from '../test/typeCheck.js';
import { generateCompatibilityTest } from '../test/compatibilityTest.js';
import { getCachedBinding, saveBinding, recordPatternSuccess } from '../utils/cache.js';
import { BinderMCP } from '../mcp/client.js';
import { findAllUsages } from '../analysis/usageFinder.js';
import { tracePropDrilling } from '../analysis/propTracer.js';
import { LearningEngine, calculateConfidence } from '../learning/engine.js';
import { generateShapeRemapper } from '../rewrite/shapeRemapper.js';
import type { MockFinding } from '../scan/mockScanner.js';
import type { Config } from '../config/types.js';
import type { BindingPlan } from '../common/types.js';

export async function safeBind(
  mocks: MockFinding[], 
  filePath: string, 
  config: Config,
  hookNames: string[],
  options: { dryRun?: boolean, interactive?: boolean, generateTests?: boolean } = {}
) {
  const results = {
    auto: 0,
    todo: 0,
    skip: 0,
    rewrittenCode: null as string | null,
    todos: [] as Array<{mock: MockFinding, hook: string, reason: string, todoComment: string}>
  };

  const mcp = new BinderMCP();
  const engine = new LearningEngine();
  await mcp.initialize(config);

  const tsConfigPath = findNearestTsConfig(dirname(filePath));
  const project = new Project({
    tsConfigFilePath: tsConfigPath || undefined,
    skipAddingFilesFromTsConfig: !tsConfigPath,
    compilerOptions: { jsx: 4, allowJs: true, esModuleInterop: true }
  });
  
  const sourceFile = project.addSourceFileAtPath(filePath);
  const apiContent = readFileSync(join(config.frontend.generatedDir, "api.ts"), "utf-8");
  
  const filePlan: BindingPlan = {
      bindings: [],
      loadingTemplate: config.frontend.loadingTemplate,
      errorTemplate: config.frontend.errorTemplate
  };

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

    // 1. Trace Prop Drilling (Phase 10)
    const drills = await tracePropDrilling(mock.name, sourceFile, project);
    if (drills.length > 0) {
        logger.info(`  [Prop Drill] Trace found: ${mock.name} passed to ${drills[0].componentName}`);
    }

    // 2. Matching Logic (Ensemble)
    const cached = getCachedBinding(filePath, mock.name);
    let hookName = (cached as any)?.hookName;
    let confidence = cached ? 1.0 : 0;
    let ambiguous = false;

    if (!hookName) {
        const hMatches = heuristicMatch([mock], hookNames, filePath);
        const sMatches = semanticMatch([mock], hookNames.map(n => ({name: n, method: 'GET', path: '/', responseType: 'any'})), apiContent);
        const cMatches = contextualMatch(mock, filePath, sourceFile, hookNames);

        const scores: Record<string, number> = {};
        for (const name of hookNames) {
            const h = hMatches.find(m => m?.hookName === name);
            const s = sMatches.find(m => m?.hookName === name);
            const c = cMatches.find(m => m?.hookName === name);
            scores[name] = (h?.confidence || 0) * 0.35 + (s?.confidence || 0) * 0.35 + (c?.confidence || 0) * 0.30;
        }

        const sorted = Object.entries(scores).filter(([_, s]) => s > 0).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0 && sorted[0][1] >= 0.6) {
            hookName = sorted[0][0];
            const ensembleScore = sorted[0][1];
            
            // Learning Engine Boost (Phase 9)
            const prediction = engine.predict({
                mockName: mock.name,
                structuralSignature: generateSignature(sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).find(id => id.getText() === mock.name)!)
            } as any);
            
            confidence = calculateConfidence(ensembleScore, prediction?.confidence || 0, 0);
            
            if (sorted[1] && (confidence - sorted[1][1]) < 0.15) ambiguous = true;
        }
    }

    if (!hookName || (confidence < 0.5 && !ambiguous)) {
      results.skip++;
      continue;
    }

    // 3. Safety Check
    const rewriteResult = safeRewrite(mock, hookName, sourceFile);
    
    // 4. Shape Remapping (Phase 13)
    let transformer = undefined;
    if (mock.resolvedContent && mock.inferredShape) {
        const remapper = generateShapeRemapper(mock.name, mock.inferredShape, {}); // Hook shape placeholder
        if (remapper) {
            transformer = remapper.remapperName;
        }
    }

    if (rewriteResult.type === 'auto' && !ambiguous) {
        filePlan.bindings.push({
            mockName: mock.name,
            hookName: hookName,
            confidence: confidence,
            actionType: 'READ',
            strategy: rewriteResult.strategy,
            transformer: transformer,
            loadingStrategy: config.frontend.loadingTemplate ? 'early-return-skeleton' : 'none',
            errorStrategy: config.frontend.errorTemplate ? 'early-return-error' : 'none'
        });
    } else {
        const todoComment = rewriteResult.todoComment || `/* TODO(BINDER): Ambiguous match or complex pattern. Suggestion: ${hookName} */`;
        results.todos.push({ mock, hook: hookName, reason: rewriteResult.reason || 'ambiguous', todoComment });
        results.todo++;
    }
  }

  // 5. TRANSACTIONAL REWRITE
  if (filePlan.bindings.length > 0) {
      try {
          let rewritten = rewriteFile(filePath, filePlan, config.frontend.generatedDir);
          rewritten = await mcp.autoFix(filePath, rewritten);
          const check = runTypeCheck(filePath, rewritten, config.frontend.generatedDir);
          
          if (check.passed) {
              results.rewrittenCode = rewritten;
              results.auto = filePlan.bindings.length;
              filePlan.bindings.forEach(b => {
                  saveBinding(filePath, b.mockName, { hookName: b.hookName });
                  const usages = findAllUsages(b.mockName, sourceFile);
                  usages.forEach(u => recordPatternSuccess(u.structuralSignature, b.strategy || 'default'));
                  if (options.generateTests) generateCompatibilityTest(filePath, b, config.frontend.generatedDir);
              });
          } else {
              for (const binding of filePlan.bindings) {
                  results.todos.push({
                      mock: mocks.find(m => m.name === binding.mockName)!,
                      hook: binding.hookName,
                      reason: 'type-check-failure',
                      todoComment: `/* TODO(BINDER): Auto-conversion failed. Manual review required. */`
                  });
              }
              results.todo += filePlan.bindings.length;
          }
      } catch (e: any) {
          logger.error(`Surgery failed: ${e.message}`);
      }
  }

  if (results.todos.length > 0) {
      const targetFile = results.rewrittenCode ? project.createSourceFile(filePath + '.tmp', results.rewrittenCode, { overwrite: true }) : sourceFile;
      for (const t of results.todos) {
          await insertTodoComment(targetFile, t.mock, t.todoComment);
      }
      results.rewrittenCode = targetFile.getFullText();
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
