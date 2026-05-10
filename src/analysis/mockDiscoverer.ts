import { Project, SyntaxKind, Node, SourceFile, TypeFormatFlags } from 'ts-morph';
import { resolve } from 'path';

export interface MockVariable {
  name: string;
  file: string;
  line: number;
  shape: string;
  valueSnippet: string;
}

/**
 * mockDiscoverer finds hardcoded data structures (arrays of objects, large JSONs)
 * that are currently being used as placeholders for real API data.
 */
export async function discoverMocks(project: Project): Promise<MockVariable[]> {
  const mocks: MockVariable[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    // Skip node_modules and configuration files
    if (sourceFile.getFilePath().includes('node_modules') || sourceFile.getFilePath().includes('config')) continue;

    // Find variable declarations that look like mock data
    sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(varDec => {
      const initializer = varDec.getInitializer();
      if (!initializer) return;

      // Heuristic: Array of objects or Object literal with more than 3 keys
      // that is NOT a result of a call expression (e.g. not from a hook)
      const isMock = (
        (Node.isArrayLiteralExpression(initializer) && initializer.getElements().length > 0) ||
        (Node.isObjectLiteralExpression(initializer) && initializer.getProperties().length > 3)
      );

      if (isMock) {
        const type = varDec.getType();
        const shape = type.getText(undefined, TypeFormatFlags.NoTruncation);
        
        // Ensure it's not already derived from an API-like call
        const name = varDec.getName();
        if (/mock|data|users|items|list|results/i.test(name)) {
          mocks.push({
            name,
            file: sourceFile.getFilePath(),
            line: varDec.getStartLineNumber(),
            shape,
            valueSnippet: initializer.getText().slice(0, 100) + '...'
          });
        }
      }
    });
  }

  return mocks;
}
