import { Project, SyntaxKind, Identifier, CallExpression, Node, ObjectBindingPattern } from 'ts-morph';
import { resolve, join } from 'path';
import { logger } from '../utils/logger.js';
import { getAnalysisCache, setAnalysisCache } from '../utils/cache.js';

/**
 * collectAPICalls uses the TypeScript TypeChecker to trace data flow
 * from API hooks to their downstream property accesses.
 */
export async function collectAPICalls(rootDir: string): Promise<APICall[]> {
  const project = new Project({
    tsConfigFilePath: join(process.cwd(), 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  // Explicitly add files from the target directory
  project.addSourceFilesAtPaths(join(rootDir, '**/*.tsx'));
  project.addSourceFilesAtPaths(join(rootDir, '**/*.ts'));

  const apiCalls: APICall[] = [];
  const typeChecker = project.getTypeChecker();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    
    // INCREMENTAL CACHE CHECK
    const cached = getAnalysisCache(filePath);
    if (cached && cached.apiCalls) {
        apiCalls.push(...cached.apiCalls);
        continue;
    }

    const fileApiCalls: APICall[] = [];
    
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(node => {
      const expression = node.getExpression();
      const name = expression.getText();

      // Heuristic to identify potential API hooks (React Query, tRPC, or custom)
      if (/^use.*(Query|Mutation|Get|Post|Put|Delete)/.test(name)) {
        const accessedProperties = new Set<string>();
        
        const parent = node.getParent();
        if (parent.getKind() === SyntaxKind.VariableDeclaration) {
          const varDec = parent.asKindOrThrow(SyntaxKind.VariableDeclaration);
          const nameNode = varDec.getNameNode();
          
          if (Node.isObjectBindingPattern(nameNode)) {
            // Case 1: Destructuring - const { data: users, isLoading } = useUsers();
            const dataElement = nameNode.getElements().find(e => {
                const propName = e.getPropertyNameNode()?.getText() || e.getNameNode().getText();
                return propName === 'data';
            });

            if (dataElement) {
              const localId = dataElement.getNameNode();
              if (Node.isIdentifier(localId)) {
                traceIdentifierUsages(localId, accessedProperties);
              }
            }
          } else if (Node.isIdentifier(nameNode)) {
            // Case 2: Direct assignment - const result = useUsers();
            traceResultObjectUsages(nameNode, accessedProperties);
          }
        }

        fileApiCalls.push({
          hookName: name,
          path: 'unknown',
          file: filePath,
          line: node.getStartLineNumber(),
          accessedProperties: [...accessedProperties]
        });
      }
    });

    apiCalls.push(...fileApiCalls);
    setAnalysisCache(filePath, { apiCalls: fileApiCalls });
  }

  return apiCalls;
}

/**
 * Traces all property accesses on a given identifier.
 */
function traceIdentifierUsages(id: Identifier, properties: Set<string>) {
    // findReferencesAsNodes() uses the TypeChecker to find all true usages of this specific symbol
    id.findReferencesAsNodes().forEach(ref => {
        const parent = ref.getParent();
        
        // Handle data.propertyName
        if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === ref) {
            properties.add(parent.getName());
        }
        
        // Handle const { propertyName } = data
        if (Node.isBindingElement(parent) && parent.getValueExpression() === ref) {
            properties.add(parent.getName());
        }

        // Handle data?.propertyName
        if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === ref) {
            properties.add(parent.getName());
        }
    });
}

/**
 * Traces usages of a result object (e.g. from useQuery) to find where .data is accessed.
 */
function traceResultObjectUsages(id: Identifier, properties: Set<string>) {
    id.findReferencesAsNodes().forEach(ref => {
        const parent = ref.getParent();
        
        if (Node.isPropertyAccessExpression(parent) && parent.getName() === 'data') {
            const dataAccess = parent;
            const dataParent = dataAccess.getParent();

            // Handle direct chained access: result.data.name
            if (Node.isPropertyAccessExpression(dataParent)) {
                properties.add(dataParent.getName());
            }

            // Handle variable assignment: const users = result.data;
            if (Node.isVariableDeclaration(dataParent)) {
                const dataId = dataParent.getNameNode();
                if (Node.isIdentifier(dataId)) {
                    traceIdentifierUsages(dataId, properties);
                }
            }
        }
    });
}
