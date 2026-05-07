import { Project, SyntaxKind, CallExpression } from 'ts-morph';
import { resolve, join } from 'path';

export interface APICall {
  hookName: string;
  path: string;
  file: string;
  line: number;
  accessedProperties: string[]; // Properties accessed on the data returned by the hook
}

export async function collectAPICalls(rootDir: string): Promise<APICall[]> {
  const project = new Project();
  project.addSourceFilesAtPaths(join(rootDir, '**/*.tsx'));
  project.addSourceFilesAtPaths(join(rootDir, '**/*.ts'));


  const apiCalls: APICall[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(node => {
      const expression = node.getExpression();
      const name = expression.getText();

      if (/^use.*(Query|Mutation|Get|Post|Put|Delete)/.test(name)) {
        const accessedProperties: string[] = [];
        
        const parent = node.getParent();
        if (parent.getKind() === SyntaxKind.VariableDeclaration) {
          const varDec = parent.asKindOrThrow(SyntaxKind.VariableDeclaration);
          const nameNode = varDec.getNameNode();
          
          let dataVarName = '';
          if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
            const binding = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
            const dataElement = binding.getElements().find(e => e.getPropertyNameNode()?.getText() === 'data' || e.getNameNode().getText() === 'data');
            if (dataElement) {
              dataVarName = dataElement.getNameNode().getText();
            }
          } else if (nameNode.getKind() === SyntaxKind.Identifier) {
            dataVarName = nameNode.getText();
          }

          if (dataVarName) {
            sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach(id => {
              if (id.getText() === dataVarName) {
                const idParent = id.getParent();
                if (idParent?.getKind() === SyntaxKind.PropertyAccessExpression) {
                  const propAccess = idParent.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
                  if (propAccess.getExpression().getText() === dataVarName) {
                    accessedProperties.push(propAccess.getName());
                  }
                }
              }
            });
          }
        }

        apiCalls.push({
          hookName: name,
          path: 'unknown',
          file: filePath,
          line: node.getStartLineNumber(),
          accessedProperties: [...new Set(accessedProperties)]
        });
      }
    });
  }

  return apiCalls;
}
