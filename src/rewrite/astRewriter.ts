import { Project, SyntaxKind, Node, SourceFile, ImportDeclaration, VariableDeclaration, FunctionDeclaration } from "ts-morph";
import { relative, dirname, resolve } from "path";
import { logger } from "../utils/logger.js";
import type { BindingPlan } from "../ai/responseParser.js";

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

      // Check if the mock is an existing function we should replace
      const existingFunc = body.getVariableDeclaration(binding.mockName) || 
                           sourceFile.getFunction(binding.mockName) ||
                           body.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).find(f => f.getName() === binding.mockName);

      if (existingFunc && isMutation) {
          logger.system(`  [Surgery] Replacing mock function "${binding.mockName}" with mutation hook`);
          if (Node.isVariableDeclaration(existingFunc)) {
              const statement = existingFunc.getFirstAncestorByKind(SyntaxKind.VariableStatement);
              statement?.remove();
          } else {
              (existingFunc as any).remove();
          }
      }

      if (isMutation) {
        // useMutation hook (React Query v5 style: isPending instead of isLoading)
        const hookCallLine = `const ${binding.mockName} = ${binding.hookName}();`;
        if (!body.getText().includes(`${binding.hookName}(`)) {
          body.insertStatements(0, hookCallLine);
        }
      } else {
        // useQuery hook
        const hookCallLine = `const { data: ${binding.mockName}, isLoading: ${binding.mockName}Loading } = ${binding.hookName}();`;
        if (!body.getText().includes(`${binding.hookName}(`)) {
          body.insertStatements(0, hookCallLine);
        }
      }
    }
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
