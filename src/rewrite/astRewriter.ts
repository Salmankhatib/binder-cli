import { Project, SyntaxKind, Node, SourceFile, ImportDeclaration, VariableDeclaration, FunctionDeclaration } from "ts-morph";
import { relative, dirname, resolve } from "path";
import { logger } from "../utils/logger.js";
import { generateShapeRemapper } from "./shapeRemapper.js";
import { rewriteEffectDependency } from "./effectRewriter.js";
import type { BindingPlan, Binding } from "../common/types.js";

export function rewriteFile(
  filePath: string,
  plan: BindingPlan,
  generatedDir: string
): string {
  if (!plan || !plan.bindings) {
    logger.error("Invalid Binding Plan: Missing bindings array.");
    throw new Error("Cannot rewrite file with empty or invalid plan.");
  }

  logger.info("Performing AST surgical rewrite...");
  
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: 4 }
  });
  
  const sourceFile = project.addSourceFileAtPath(filePath);
  const mockNames = new Set(plan.bindings.map(b => b.mockName));
  const hookNames = [...new Set(plan.bindings.map(b => b.hookName).filter(Boolean))];
  
  logger.system(`Targeting hooks: ${hookNames.join(", ")}`);
  
  // 1. Remove mock imports
  removeMockImports(sourceFile, mockNames);
  
  // 1.5 Remove local mock variable declarations
  removeMockDeclarations(sourceFile, mockNames);
  
  // 2. Import Management
  const importPath = calculateImportPath(filePath, generatedDir);
  ensureHookImports(sourceFile, hookNames, importPath);
  
  // 3. Transformation
  transformComponents(sourceFile, plan);
  
  sourceFile.organizeImports();
  logger.success("AST rewrite complete");
  return sourceFile.getFullText();
}

function calculateImportPath(targetFile: string, generatedDir: string): string {
  const fromDir = dirname(resolve(targetFile)).replace(/\\/g, "/");
  const toDir = resolve(generatedDir).replace(/\\/g, "/");
  let rel = relative(fromDir, toDir).replace(/\\/g, "/");
  if (!rel) rel = ".";
  if (!rel.startsWith(".")) rel = "./" + rel;
  return `${rel}/api`;
}

function removeMockDeclarations(sourceFile: SourceFile, mockNames: Set<string>): void {
  sourceFile.getVariableDeclarations().forEach(decl => {
    if (mockNames.has(decl.getName())) {
      const statement = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
      statement?.remove();
    }
  });
}

function removeMockImports(sourceFile: SourceFile, mockNames: Set<string>): void {
  const imports = sourceFile.getImportDeclarations();
  for (const imp of imports) {
    const namedImports = imp.getNamedImports();
    for (const named of namedImports) {
      if (mockNames.has(named.getName())) {
        named.remove();
      }
    }
    if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
      imp.remove();
    }
  }
}

function ensureHookImports(sourceFile: SourceFile, hookNames: string[], importPath: string): void {
  let existingImport = sourceFile.getImportDeclaration(i => i.getModuleSpecifierValue() === importPath);
  if (!existingImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: importPath,
      namedImports: hookNames
    });
  } else {
    for (const name of hookNames) {
      if (!existingImport.getNamedImports().some(n => n.getName() === name)) {
        existingImport.addNamedImport(name);
      }
    }
  }
}

import { applyDefaultStrategy } from "./strategies/default.js";
import { applyWrapInUseMemo } from "./strategies/wrapInUseMemo.js";
import { applyGuardByLoading } from "./strategies/guardByLoading.js";
import { applyClientPagination } from "./strategies/clientPagination.js";
import { applyLazyInitialize } from "./strategies/lazyInitialize.js";
import { applyMigrateToUseQuery } from "./strategies/migrateToUseQuery.js";
import { applyTestWrapper } from "./strategies/testWrapper.js";
import { applyMutationSetter } from "./strategies/mutationSetter.js";
import { applySubscriptionBind } from "./strategies/subscriptionBind.js";
import { applyOptimisticMutation } from "./strategies/optimisticMutation.js";
import { applyManualFix } from "./strategies/manual.js";
import { ReactQueryAdapter } from "../adapters/reactQuery.adapter.js";
import { TrpcAdapter } from "../adapters/trpc.adapter.js";

function transformComponents(sourceFile: SourceFile, plan: BindingPlan): void {
  // ADAPTIVE: Choose adapter based on protocol
  // This needs to be passed down or retrieved from a global context/plan
  const protocol = (plan as any).protocol || 'rest';
  const adapter = protocol === 'trpc' 
    ? new TrpcAdapter((plan as any).trpcExportName || 'trpc') 
    : new ReactQueryAdapter();
  
  const components = [
    ...sourceFile.getFunctions().filter(f => f.getBody()),
    ...sourceFile.getVariableDeclarations().filter(v => {
      const init = v.getInitializer();
      return init && Node.isArrowFunction(init);
    })
  ];

  for (const comp of components) {
    const body = getComponentBody(comp);
    if (!body || !Node.isBlock(body)) continue;

    for (const binding of plan.bindings) {
      // Clean mock name if necessary (MOCK_USERS -> users)
      if (binding.mockName.toUpperCase().startsWith('MOCK_') || binding.mockName.toUpperCase().startsWith('FAKE_')) {
          const cleanName = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
          
          sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
            .filter(id => id.getText() === binding.mockName)
            .forEach(id => {
                try {
                    id.rename(cleanName);
                } catch (e) {
                    // Fallback for nodes that can't be renamed normally
                    (id as any).replaceWithText(cleanName);
                }
            });
            
          binding.mockName = cleanName; 
      }
    }

    // Now proceed with normal transformations
    for (const binding of plan.bindings) {
      const strategy = binding.strategy || 'default';
      
      logger.system(`  [Surgery] Applying strategy: ${strategy} for ${binding.mockName}`);

      switch (strategy) {
        case 'wrap-in-usememo':
          applyWrapInUseMemo(body, binding, sourceFile, adapter);
          break;
        case 'guard-by-loading':
          applyGuardByLoading(body, binding, sourceFile, adapter);
          break;
        case 'client-pagination':
          applyClientPagination(body, binding, sourceFile, adapter);
          break;
        case 'lazy-initialize':
          applyLazyInitialize(body, binding, sourceFile, adapter);
          break;
        case 'migrate-to-usequery':
          applyMigrateToUseQuery(body, binding, sourceFile, adapter);
          break;
        case 'test-wrapper':
          applyTestWrapper(body, binding, sourceFile, adapter);
          break;
        case 'optimistic-mutation':
          applyOptimisticMutation(body, binding, sourceFile, adapter);
          break;
        case 'mutation-create':
        case 'mutation-update':
        case 'mutation-delete':
          applyMutationSetter(body, binding, sourceFile, adapter);
          break;
        case 'subscription-bind':
          applySubscriptionBind(body, binding, sourceFile, adapter);
          break;
        case 'manual':
          applyManualFix(body, binding);
          break;
        default:
          // Pass templates from plan to default strategy
          (binding as any).loadingTemplate = plan.loadingTemplate;
          (binding as any).errorTemplate = plan.errorTemplate;
          applyDefaultStrategy(body, binding, sourceFile, adapter);
          break;
      }
    }
  }
}

function getComponentBody(comp: any): Node | undefined {
    if (Node.isFunctionDeclaration(comp)) return comp.getBody();
    if (Node.isVariableDeclaration(comp)) {
        const init = comp.getInitializer();
        if (init && Node.isArrowFunction(init)) return init.getBody();
    }
    return undefined;
}
