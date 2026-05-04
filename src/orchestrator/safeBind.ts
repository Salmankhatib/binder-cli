// src/orchestrator/safeBind.ts
import { Project, SyntaxKind } from 'ts-morph';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { rewriteFile } from '../rewrite/astRewriter.js';
import { logger } from '../utils/logger.js';
import { runTypeCheck } from '../test/typeCheck.js';
import { DecisionEngine } from '../engine/decisionEngine.js';
import { SessionManager } from '../human/sessionManager.js';
import { findAllUsages } from '../analysis/usageFinder.js';
import { tracePropDrilling } from '../analysis/propTracer.js';
import type { MockFinding } from '../scan/mockScanner.js';
import type { Config } from '../config/types.js';
import type { BindingPlan, Binding } from '../common/types.js';
import { ProjectContext } from '../engine/types.js';

export async function safeBind(
  mocks: MockFinding[], 
  filePath: string, 
  config: Config,
  hookNames: string[],
  options: { dryRun?: boolean, interactive?: boolean, generateTests?: boolean } = {}
) {
  const results = {
    auto: 0,
    human: 0,
    todo: 0,
    skip: 0,
    rewrittenCode: null as string | null,
    todos: [] as Array<{mock: MockFinding, hook: string, reason: string, todoComment: string}>
  };

  const decisionEngine = new DecisionEngine();
  const sessionManager = new SessionManager();

  const tsConfigPath = findNearestTsConfig(dirname(filePath));
  const project = new Project({
    tsConfigFilePath: tsConfigPath || undefined,
    skipAddingFilesFromTsConfig: !tsConfigPath,
    compilerOptions: { jsx: 4, allowJs: true, esModuleInterop: true }
  });
  
  const sourceFile = project.addSourceFileAtPath(filePath);
  const apiContent = readFileSync(join(config.frontend.generatedDir, "api.ts"), "utf-8");
  
  const projectContext: ProjectContext = {
    filePath,
    folderContext: dirname(filePath),
    imports: sourceFile.getImportDeclarations().map(i => i.getModuleSpecifierValue()),
    dependencies: [], // Could be populated from package.json
    detectedStyle: config.frontend.loadingTemplate ? 'Skeleton' : 'default',
    tsConfigPath: tsConfigPath
  };

  const filePlan: BindingPlan = {
      bindings: [],
      loadingTemplate: config.frontend.loadingTemplate,
      errorTemplate: config.frontend.errorTemplate
  };

  for (const mock of mocks) {
    const usages = findAllUsages(mock.name, sourceFile);
    const drills = await tracePropDrilling(mock.name, sourceFile, project);
    
    const decision = await decisionEngine.decide(
      mock, 
      usages as any, 
      projectContext, 
      hookNames, 
      apiContent, 
      drills
    );

    if (decision.type === 'auto') {
      logger.success(`  [Auto] ${mock.name} -> ${decision.binding?.hookName} (${(decision.confidence * 100).toFixed(0)}%)`);
      filePlan.bindings.push(decision.binding!);
      results.auto++;
    } else if (decision.type === 'human' && options.interactive) {
      const { choice, apply } = await sessionManager.resolveHumanDecision(mock, decision);
      if (apply) {
        const binding: Binding = {
          ...decision.binding!,
          strategy: choice.id
        };
        filePlan.bindings.push(binding);
        results.human++;
      } else {
        results.todo++;
        results.todos.push({
          mock,
          hook: decision.binding?.hookName || 'unknown',
          reason: 'human-skipped',
          todoComment: `/* TODO(BINDER): Human skipped this decision. */`
        });
      }
    } else {
      // TODO or Non-interactive Human
      const context = decision.todoContext;
      const todoComment = `/* TODO(BINDER): ${context?.explanation}. Steps: ${context?.suggestedSteps.join(', ')} */`;
      results.todos.push({
        mock,
        hook: decision.binding?.hookName || 'unknown',
        reason: context?.reason || 'complex',
        todoComment
      });
      results.todo++;
    }
  }

  if (filePlan.bindings.length > 0) {
    results.rewrittenCode = rewriteFile(filePath, filePlan, config.frontend.generatedDir);
  }

  return results;
}

function findNearestTsConfig(dir: string): string | null {
  let current = dir;
  while (current !== dirname(current)) {
    const p = join(current, 'tsconfig.json');
    if (existsSync(p)) return p;
    current = dirname(current);
  }
  return null;
}
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
  const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(line - 1, 0);
  const node = sourceFile.getDescendantAtPos(pos);
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
