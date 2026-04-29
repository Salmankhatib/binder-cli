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

function transformComponents(sourceFile: SourceFile, plan: BindingPlan): void {
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
      const isMutation = binding.hookName.toLowerCase().includes('post') || 
                         binding.hookName.toLowerCase().includes('delete') || 
                         binding.hookName.toLowerCase().includes('patch') || 
                         binding.hookName.toLowerCase().includes('put');

      // --- NEW: Professional Name Cleanup ---
      // If variable is MOCK_AGENTS, we rename it to 'agents' globally in the file
      let targetName = binding.mockName;
      if (binding.mockName.toUpperCase().startsWith('MOCK_') || binding.mockName.toUpperCase().startsWith('FAKE_')) {
          const cleanName = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
          
          // Use AST to rename all occurrences safely
          const identifier = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
            .find(id => id.getText() === binding.mockName);
          
          if (identifier) {
            logger.system(`  [Surgery] Cleaning name: ${binding.mockName} -> ${cleanName}`);
            identifier.rename(cleanName);
            targetName = cleanName;
          }
      }

      // Check if the mock is an existing function or variable we should replace
      const existingFunc = body.getVariableDeclaration(targetName) || 
                           sourceFile.getFunction(targetName) ||
                           body.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).find(f => f.getName() === targetName);

      if (existingFunc) {
          logger.system(`  [Surgery] Replacing existing declaration of "${targetName}" with hook/mutation`);
          if (Node.isVariableDeclaration(existingFunc)) {
              const statement = existingFunc.getFirstAncestorByKind(SyntaxKind.VariableStatement);
              // Only remove if it's a "mock" declaration (e.g. uses useQuery or is a mock func)
              const text = statement?.getText() || "";
              if (text.includes('useQuery') || text.includes('Promise.resolve') || isMutation) {
                statement?.remove();
              }
          } else {
              (existingFunc as any).remove();
          }
      }

      if (isMutation) {
        // useMutation hook
        const hookCallLine = `const ${targetName} = ${binding.hookName}();`;
        if (!body.getText().includes(`${binding.hookName}(`)) {
          insertAfterLastHook(body, hookCallLine);
        }
      } else {
        // useQuery hook with Strategy support
        const hookVar = targetName;
        
        // FIX 3: Detect Mandatory Parameters
        const hookDecl = sourceFile.getImportDeclaration(i => i.getModuleSpecifierValue().includes('api'))
          ?.getModuleSpecifier().getSymbol()?.getDeclarations()[0]; // Simplified lookup
          
        let hookCallLine = "";
        
        // STRATEGY BRANCHING
        switch (binding.strategy) {
          case 'wrap-in-usememo':
            hookCallLine = `const { data: ${hookVar}Raw, isLoading: ${hookVar}Loading, isError: ${hookVar}Error } = ${binding.hookName}();\n`;
            hookCallLine += `const ${hookVar} = useMemo(() => ${hookVar}Raw?.${binding.transformer || 'map(x => x)'}, [${hookVar}Raw]);`;
            ensureHookImports(sourceFile, ['useMemo'], 'react');
            break;
            
          case 'migrate-to-usequery':
            hookCallLine = `const { data: ${hookVar}, isLoading: ${hookVar}Loading, isError: ${hookVar}Error } = ${binding.hookName}();`;
            break;
            
          case 'swap-data-source-only':
            hookCallLine = `const { data: ${hookVar} } = ${binding.hookName}();`;
            break;

          case 'inject-both-hooks':
            hookCallLine = `const { data: ${hookVar}Result } = ${binding.hookName}();`;
            break;

          case 'rewrite-effect-deps':
            hookCallLine = `const { data: ${hookVar} } = ${binding.hookName}();`;
            // Find useEffect calls and rewrite them
            body.getDescendantsOfKind(SyntaxKind.CallExpression)
                .filter(c => c.getExpression().getText() === 'useEffect')
                .forEach(effect => {
                    const result = rewriteEffectDependency(effect, binding.mockName, hookVar);
                    if (result) {
                        effect.replaceWithText(`useEffect(() => {\n  ${result.replaceBody}\n}, [${result.replaceDeps.join(', ')}])`);
                    }
                });
            break;

          case 'wrap-in-effect-guard':
            hookCallLine = `const { data: ${hookVar}, isLoading: ${hookVar}Loading } = ${binding.hookName}();`;
            break;

          default:
            hookCallLine = `const { data: ${hookVar}, isLoading: ${hookVar}Loading, isError: ${hookVar}Error } = ${binding.hookName}();`;
        }

        // Shape Remapping Integration (Phase 13)
        if (binding.transformer) {
            const remapper = generateShapeRemapper(binding.mockName, {}, {}); // Shapes passed via plan in future
            if (remapper) {
                sourceFile.insertStatements(sourceFile.getImportDeclarations().length + 1, remapper.code);
                hookCallLine = hookCallLine.replace(`data: ${hookVar}`, `data: ${hookVar}Raw`);
                hookCallLine += `\nconst ${hookVar} = ${hookVar}Raw ? ${remapper.remapperName}(${hookVar}Raw) : undefined;`;
            }
        }
        
        if (!body.getText().includes(`${binding.hookName}(`)) {
          insertAfterLastHook(body, hookCallLine);
          
          if (binding.strategy !== 'swap-data-source-only' && binding.strategy !== 'ensure-superset') {
            // Apply Loading Strategy
            if (binding.loadingStrategy === 'early-return-skeleton') {
                const template = plan.loadingTemplate || `<div>Loading ${hookVar}...</div>`;
                insertStatementAfter(body, hookCallLine, `if (${hookVar}Loading) return ${template};`);
            }

            // Apply Error Strategy
            if (binding.errorStrategy === 'early-return-error') {
                const template = plan.errorTemplate || `<div>Error loading ${hookVar}</div>`;
                insertStatementAfter(body, hookCallLine, `if (${hookVar}Error) return ${template};`);
            }
          }
        }
      }
    }
  }
}

function insertAfterLastHook(body: Node, statement: string) {
  const statements = (body as any).getStatements();
  let lastHookIndex = -1;
  
  for (let i = 0; i < statements.length; i++) {
    if (statements[i].getText().includes('use')) {
      lastHookIndex = i;
    }
  }
  
  (body as any).insertStatements(lastHookIndex + 1, statement);
}

function insertStatementAfter(body: Node, afterText: string, statement: string) {
  const statements = (body as any).getStatements();
  const index = statements.findIndex((s: any) => s.getText().includes(afterText));
  if (index !== -1) {
    (body as any).insertStatements(index + 1, statement);
  }
}

function getComponentBody(node: any): Node | undefined {
  if (Node.isFunctionDeclaration(node)) return node.getBody();
  if (Node.isVariableDeclaration(node)) {
    const init = node.getInitializer();
    if (init && Node.isArrowFunction(init)) return init.getBody();
  }
  return undefined;
}
