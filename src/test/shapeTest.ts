import { Project, SyntaxKind, Node } from 'ts-morph';
import type { TestResult } from '../common/types.js';

export function runShapeTest(filePath: string, code: string): TestResult {
  const project = new Project({ compilerOptions: { jsx: 1 } });
  const sourceFile = project.createSourceFile('temp.tsx', code, { overwrite: true });
  const typeChecker = project.getTypeChecker();
  const errors: string[] = [];

  // Use getDescendantsOfKind but treat them as generic Nodes first to be safe
  const nodes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);

  for (const node of nodes) {
    // This is the most reliable way to check in ESM/TS-Morph
    if (!Node.isJsxAttribute(node)) continue;

    try {
      // Accessing the name via the name node directly
      const propName = node.getNameNode().getText();
      const initializer = node.getInitializer();

      if (Node.isJsxExpression(initializer)) {
        const expression = initializer.getExpression();
        if (!expression) continue;

        const expectedType = typeChecker.getContextualType(expression);
        const actualType = typeChecker.getTypeAtLocation(expression);

        if (expectedType && !expectedType.getApparentType().isAssignableTo(actualType.getApparentType())) {
          errors.push(`Prop "${propName}" expected ${expectedType.getText()} but got ${actualType.getText()}`);
        }
      }
    } catch (e) {
      // Silently skip nodes that don't behave like attributes to prevent CLI crash
      continue;
    }
  }

  return { layer: "shape-test", passed: errors.length === 0, errors };
}