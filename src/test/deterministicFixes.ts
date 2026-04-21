import { Project, SyntaxKind, Node, SourceFile, VariableDeclaration } from "ts-morph";
import { logger } from "../utils/logger.js";

export interface TypeError {
  code: string;
  message: string;
  line: number;
}

export function applyDeterministicFixes(sourceCode: string, errors: TypeError[]): string {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 4 } });
  const sourceFile = project.createSourceFile("temp.tsx", sourceCode);
  let appliedCount = 0;

  logger.system("Starting deterministic fixing waterfall...");

  if (enforceHookRules(sourceFile)) appliedCount++;

  for (let pass = 1; pass <= 3; pass++) {
    let passApplied = false;
    for (const error of errors) {
      if (attemptFix(sourceFile, error)) {
        appliedCount++;
        passApplied = true;
      }
    }
    if (!passApplied) break;
  }

  if (appliedCount > 0) {
    logger.success(`  Applied ${appliedCount} deterministic AST fixes`);
    return sourceFile.getFullText();
  }
  return sourceCode;
}

function attemptFix(sourceFile: SourceFile, error: TypeError): boolean {
  const msg = error.message.toLowerCase();

  // 1. Orval Data Wrapper (data.map -> data.data.map)
  if (msg.includes("property") && msg.includes("map") && msg.includes("does not exist on type")) {
    return fixOrvalDataMap(sourceFile);
  }

  // 2. React Query v5 Mutation (isLoading -> isPending)
  if (msg.includes("property 'isloading' does not exist")) {
    return fixMutationPendingState(sourceFile);
  }

  // 3. Missing Imports
  if (msg.includes("cannot find name") && (msg.includes("'use") || msg.includes("hook"))) {
    const hookName = error.message.match(/'(\w+)'/)?.[1];
    if (hookName) return injectMissingHookImport(sourceFile, hookName);
  }

  // 4. Null Coalescing (Undefined/Null)
  if (msg.includes("possibly 'undefined'") || msg.includes("possibly 'null'")) {
    return fixStrictNullChecks(sourceFile);
  }

  return false;
}

function fixOrvalDataMap(sourceFile: SourceFile): boolean {
  let applied = false;
  sourceFile.forEachDescendant(node => {
    if (Node.isPropertyAccessExpression(node) && node.getName() === "map") {
      const expr = node.getExpression();
      if (!expr.getText().endsWith(".data") && !expr.getText().includes("??")) {
          // If the type is known to be the Orval response object
          expr.replaceWithText(`${expr.getText()}?.data`);
          applied = true;
      }
    }
  });
  return applied;
}

function fixMutationPendingState(sourceFile: SourceFile): boolean {
  let applied = false;
  sourceFile.forEachDescendant(node => {
    if (Node.isIdentifier(node) && node.getText().endsWith("Loading")) {
       const parent = node.getParent();
       if (parent && (Node.isPropertyAccessExpression(parent) || Node.isBindingElement(parent))) {
           node.replaceWithText(node.getText().replace("Loading", "Pending"));
           applied = true;
       }
    }
  });
  return applied;
}

function enforceHookRules(sourceFile: SourceFile): boolean {
  let applied = false;
  const hookCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => call.getExpression().getText().startsWith("use"));
  for (const call of hookCalls) {
    const forbiddenParent = call.getFirstAncestor(a => Node.isIfStatement(a) || Node.isIterationStatement(a) || Node.isSwitchStatement(a));
    if (forbiddenParent) {
      const component = call.getFirstAncestor(a => Node.isFunctionDeclaration(a) || (Node.isVariableDeclaration(a) && a.getInitializer() && Node.isArrowFunction(a.getInitializer()!)));
      if (component) {
        const statement = call.getFirstAncestorByKind(SyntaxKind.VariableStatement) || call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
        if (statement) {
          const body = Node.isFunctionDeclaration(component) ? component.getBody() : (component as any).getInitializer()?.getBody();
          if (body && Node.isBlock(body)) {
             const text = statement.getText();
             statement.remove();
             body.insertStatements(0, text);
             applied = true;
             logger.system(`  [Rule] Moved hook to root`);
          }
        }
      }
    }
  }
  return applied;
}

function injectMissingHookImport(sourceFile: SourceFile, name: string): boolean {
  const existing = sourceFile.getImportDeclaration(i => i.getModuleSpecifierValue().includes("generated/api"));
  if (existing) {
    if (!existing.getNamedImports().some(n => n.getName() === name)) {
      existing.addNamedImport(name);
      return true;
    }
  } else {
    sourceFile.addImportDeclaration({ moduleSpecifier: "../generated/api", namedImports: [name] });
    return true;
  }
  return false;
}

function fixStrictNullChecks(sourceFile: SourceFile): boolean {
  let applied = false;
  sourceFile.forEachDescendant(node => {
    if (Node.isPropertyAccessExpression(node)) {
      const expr = node.getExpression();
      const name = node.getName();
      if ((expr.getText().toLowerCase().includes("mock") || expr.getText() === "data") && !node.getText().includes("?.")) {
         node.replaceWithText(`${expr.getText()}?.${name}`);
         applied = true;
      }
    }
  });
  return applied;
}
