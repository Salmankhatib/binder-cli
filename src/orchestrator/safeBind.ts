// src/orchestrator/safeBind.ts
import { Project, SyntaxKind, Node } from 'ts-morph';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { rewriteFile } from '../rewrite/astRewriter.js';
import { logger } from '../utils/logger.js';
import { runTypeCheck } from '../test/typeCheck.js';
import { DecisionEngine } from '../engine/decisionEngine.js';
import { SessionManager } from '../human/sessionManager.js';
import { findAllUsages } from '../analysis/usageFinder.js';
import { tracePropDrilling } from '../analysis/propTracer.js';
import { buildRepositoryImpactMap } from '../analysis/globalIndex.js';
import { TrpcRouterAnalyzer, ProcedureInfo } from '../analysis/trpcAnalyzer.js';
import { MutationAnalyzer, MutationTemplate } from '../analysis/mutationAnalyzer.js';
import { HookIndexer } from '../analysis/hookIndexer.js';
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
    todos: [] as Array<{mock: MockFinding, hook: string, reason: string, todoComment: string}>,
    successes: [] as Array<{ mockName: string, hookName: string }>
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
  
  let targetHooks = hookNames;
  let apiContent = "";
  let trpcProcedures: Map<string, ProcedureInfo> | undefined;

  if (config.protocol === 'trpc' && config.backend.trpcAppRouterPath) {
      const analyzer = new TrpcRouterAnalyzer(tsConfigPath || undefined);
      trpcProcedures = await analyzer.analyze(resolve(config.backend.trpcAppRouterPath));
      targetHooks = Array.from(trpcProcedures.keys());
      
      // Generate a mock api.ts content for the semantic matcher to digest
      apiContent = Array.from(trpcProcedures.entries()).map(([path, info]) => {
          return `export const ${path.replace(/\./g, '_')} = () => ({} as ${info.outputType});`;
      }).join("\n");
  } else {
      const apiPath = join(config.frontend.generatedDir, "api.ts");
      if (existsSync(apiPath)) {
        apiContent = readFileSync(apiPath, "utf-8");
        // If hookNames not provided or empty, scan them
        if (!targetHooks || targetHooks.length === 0) {
            targetHooks = [...apiContent.matchAll(/export (?:function|const) (use\w+)/g)].map(m => m[1]);
        }
      }
  }

  // PRIORITY A: Project-Wide Symbol Index
  logger.startSpinner("Building project-wide symbol impact map...");
  const impactMap = await buildRepositoryImpactMap(project);
  logger.stopSpinner(true, "Impact map ready.");

  const mutationAnalyzer = new MutationAnalyzer();
  const mutationTemplates = await mutationAnalyzer.analyzeProject(project);

  const hookIndexer = new HookIndexer();
  const customHookWrappers = await hookIndexer.indexProject(project);
  
  const projectContext: ProjectContext = {
    filePath,
    folderContext: dirname(filePath),
    imports: sourceFile.getImportDeclarations().map(i => i.getModuleSpecifierValue()),
    dependencies: [], 
    detectedStyle: config.frontend.loadingTemplate ? 'Skeleton' : 'default',
    tsConfigPath: tsConfigPath,
    impactMap: impactMap,
    protocol: config.protocol,
    llm: config.llm
  };

  const filePlan: BindingPlan = {
      bindings: [],
      loadingTemplate: config.frontend.loadingTemplate,
      errorTemplate: config.frontend.errorTemplate,
      protocol: config.protocol,
      trpcExportName: config.backend.trpcExportName
  };

  for (const mock of mocks) {
    if (mock.type === 'msw_handler' || mock.type === 'mirage_handler') {
        results.todos.push({
          mock,
          hook: 'N/A',
          reason: 'Mock Server Handler detected',
          todoComment: `/* TODO(BINDER): Detected ${mock.type.replace('_', ' ').toUpperCase()}. 
Once the frontend components are bound to hooks, you should remove this handler from your mock server setup. */`
        });
        results.todo++;
        continue;
    }

    const usages = findAllUsages(mock.name, sourceFile);
    const drills = await tracePropDrilling(mock.name, sourceFile, project);
    
    const decision = await decisionEngine.decide(
      mock, 
      usages as any, 
      projectContext, 
      targetHooks, 
      apiContent, 
      drills,
      trpcProcedures,
      mutationTemplates,
      customHookWrappers
    );

    if (decision.type === 'auto') {
      logger.success(`  [Auto] ${mock.name} -> ${decision.binding?.hookName} (${(decision.confidence * 100).toFixed(0)}%)`);
      filePlan.bindings.push(decision.binding!);
      results.successes.push({ mockName: mock.name, hookName: decision.binding!.hookName });
      results.auto++;
    } else if (decision.type === 'human' && options.interactive) {
      const { choice, apply } = await sessionManager.resolveHumanDecision(mock, decision);
      if (apply) {
        const binding: Binding = {
          ...decision.binding!,
          strategy: choice.id
        };
        filePlan.bindings.push(binding);
        results.successes.push({ mockName: mock.name, hookName: binding.hookName });
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

  const mcp = new BinderMCP();
  await mcp.initialize(config);

  // Transactional Rewrite & Validation
  if (filePlan.bindings.length > 0) {
      // Phase 5.2: Batch/Parallel Query Detection
      const queryBindings = filePlan.bindings.filter(b => b.actionType === 'READ');
      if (queryBindings.length >= 2 && config.protocol === 'trpc') {
          logger.info(`  [Optimization] Detected ${queryBindings.length} parallel queries. Suggesting batch mode.`);
          // In the future, we could swap for trpc.useQueries()
      }

      try {
          let rewritten = rewriteFile(filePath, filePlan, config.frontend.generatedDir);
          
          // Self-healing layer: use MCP to fix immediate issues (imports, syntax, etc.)
          rewritten = await mcp.autoFix(filePath, rewritten);
          
          const check = runTypeCheck(filePath, rewritten, config.frontend.generatedDir, config.backend.trpcAppRouterPath);
          
          if (check.passed) {
              results.rewrittenCode = rewritten;
              filePlan.bindings.forEach(b => {
                  saveBinding(filePath, b.mockName, { hookName: b.hookName });
                  const usages = findAllUsages(b.mockName, sourceFile);
                  usages.forEach(u => recordPatternSuccess(u.structuralSignature, b.strategy || 'default'));
              });
          } else {
              logger.warn(`  [Warning] Type check failed for auto-conversions in ${filePath}. Attempting self-heal...`);
              
              // Second pass self-heal with diagnostics
              const diagnostics = check.errors || [];
              const healed = await mcp.repair({
                  filePath,
                  code: rewritten,
                  mockName: filePlan.bindings[0]?.mockName || 'unknown',
                  hookName: filePlan.bindings[0]?.hookName || 'unknown',
                  diagnostics
              });
              
              if (healed.success && healed.newCode) {
                logger.success(`  [Heal] MCP successfully repaired surgery issues.`);
                results.rewrittenCode = healed.newCode;
              } else {
                logger.error(`  [Heal] MCP could not resolve type errors. Reverting.`);
                for (const binding of filePlan.bindings) {
                    results.todos.push({
                        mock: mocks.find(m => m.name === binding.mockName)!,
                        hook: binding.hookName,
                        reason: 'type-check-failure',
                        todoComment: `/* TODO(BINDER): Auto-conversion failed type check. Manual review required. */`
                    });
                }
                results.todo += filePlan.bindings.length;
                results.auto = 0;
                results.human = 0;
              }
          }
      } catch (e: any) {
          logger.error(`Surgery failed: ${e.message}`);
      }
  }

  // Insert TODOs into the code if any
  if (results.todos.length > 0) {
      const targetContent = results.rewrittenCode || readFileSync(filePath, 'utf-8');
      const tempFile = project.createSourceFile(filePath + '.tmp.tsx', targetContent, { overwrite: true });
      
      for (const t of results.todos) {
          insertTodoComment(tempFile, t.mock, t.todoComment);
      }
      
      results.rewrittenCode = tempFile.getFullText();
  }

  return results;
}

function insertTodoComment(sourceFile: any, mock: MockFinding, comment: string) {
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
