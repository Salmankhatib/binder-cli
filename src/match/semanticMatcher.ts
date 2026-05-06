import { Project, SyntaxKind, Type, Node } from 'ts-morph';
import { logger } from '../utils/logger.js';
import type { MockFinding } from '../scan/mockScanner.js';

export interface HookSignature {
  name: string;
  method: string;
  path: string;
  responseType: string;
  params?: Array<{ name: string; type: string; required: boolean }>;
}

export interface SemanticMatch {
  mockName: string;
  hookName: string;
  confidence: number;
}

/**
 * Matches mocks to hooks by comparing their data structures (AST shapes).
 */
export function semanticMatch(
  mocks: MockFinding[],
  hooks: HookSignature[],
  apiContent: string,
  trpcProcedures?: Map<string, any>
): SemanticMatch[] {
  logger.system('Running semantic shape matcher...');
  
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 4 } });
  const apiFile = project.createSourceFile('api.ts', apiContent);
  
  const matches: SemanticMatch[] = [];

  for (const mock of mocks) {
    if (!mock.inferredShape) continue;

    const mockKeys = Object.keys(mock.inferredShape);
    let bestMatch: SemanticMatch | null = null;

    for (const hook of hooks) {
      let hookReturnType: Type | null = null;

      if (trpcProcedures && trpcProcedures.has(hook.name)) {
          // Special handling for tRPC: create a temp file with the output type to get its properties
          const proc = trpcProcedures.get(hook.name);
          const tempFile = project.createSourceFile(`temp_${hook.name.replace(/\./g, '_')}.ts`, `type T = ${proc.outputType};`, { overwrite: true });
          let typeAlias = tempFile.getTypeAlias('T')?.getType();
          if (typeAlias) {
              // If it's a function type (e.g. from useQuery definition), get its return type
              const callSigs = typeAlias.getCallSignatures();
              if (callSigs.length > 0) {
                  typeAlias = callSigs[0].getReturnType();
              }
              // If it has a 'data' property, drill down (like React Query hooks)
              const dataProp = typeAlias.getProperty('data');
              if (dataProp) {
                  hookReturnType = project.getTypeChecker().getTypeOfSymbolAtLocation(dataProp, tempFile.getTypeAlias('T')!.getNameNode());
              } else {
                  hookReturnType = typeAlias;
              }
          }
      } else {
          hookReturnType = extractHookReturnType(apiFile, hook.name);
      }

      if (!hookReturnType) continue;

      const hookKeys = extractKeysFromType(hookReturnType);
      
      // Calculate Jaccard similarity of keys
      const intersection = mockKeys.filter(k => hookKeys.includes(k));
      const union = Array.from(new Set([...mockKeys, ...hookKeys]));
      const similarity = intersection.length / union.length;

      if (similarity > 0.6) {
        const confidence = 0.9 + (similarity * 0.1); // High confidence if shapes match
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { mockName: mock.name, hookName: hook.name, confidence };
        }
      }
    }

    if (bestMatch) {
      logger.system(`  [Semantic Match] ${mock.name} -> ${bestMatch.hookName} (${(bestMatch.confidence * 100).toFixed(0)}%)`);
      matches.push(bestMatch);
    }
  }

  return matches;
}

function extractHookReturnType(apiFile: any, hookName: string): Type | null {
  const hook = apiFile.getFunction(hookName) || 
               apiFile.getVariableDeclaration(hookName) ||
               apiFile.getFunction(hookName.replace(/\./g, '_')) ||
               apiFile.getVariableDeclaration(hookName.replace(/\./g, '_'));
  if (!hook) return null;

  let type = hook.getType();
  
  // If it's a function/arrow function, get its return type
  const callSignatures = type.getCallSignatures();
  if (callSignatures.length > 0) {
      type = callSignatures[0].getReturnType();
  }

  // For React Query hooks, we need to drill down into the UseQueryResult
  const typeText = type.getText();
  if (typeText.includes('UseQueryResult') || typeText.includes('UseMutationResult')) {
    const typeArgs = type.getTypeArguments();
    if (typeArgs.length > 0) {
      return typeArgs[0]; // The TData type
    }
  }

  // FALLBACK: If the hook returns an object with a 'data' property (standard RQ hook)
  const dataProp = type.getProperty('data');
  if (dataProp) {
      const propType = (apiFile as SourceFile).getProject().getTypeChecker().getTypeOfSymbolAtLocation(dataProp, hook.getNameNode());
      if (propType) return propType;
  }

  return type;
}

function extractKeysFromType(type: Type): string[] {
  // If it's an array, get the element type
  if (type.isArray()) {
    const elementType = type.getArrayElementType();
    if (elementType) return extractKeysFromType(elementType);
  }

  // Handle Union types (like success | error) - take the one with more properties
  if (type.isUnion()) {
    const props = type.getUnionTypes().map(t => t.getApparentProperties().map(p => p.getName()));
    return props.reduce((a, b) => (a.length > b.length ? a : b), []);
  }

  return type.getApparentProperties().map(p => p.getName());
}
