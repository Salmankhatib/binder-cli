import { Project, SyntaxKind, Type, Node } from 'ts-morph';
import { logger } from '../utils/logger.js';
import type { MockFinding } from '../scan/mockScanner.js';
import type { HookSignature } from './bindingEngine.js';

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
  apiContent: string
): SemanticMatch[] {
  logger.system('Running semantic shape matcher...');
  
  const project = new Project({ useInMemoryFileSystem: true });
  const apiFile = project.createSourceFile('api.ts', apiContent);
  const matches: SemanticMatch[] = [];

  for (const mock of mocks) {
    if (!mock.inferredShape) continue;

    const mockKeys = Object.keys(mock.inferredShape);
    let bestMatch: SemanticMatch | null = null;

    for (const hook of hooks) {
      const hookReturnType = extractHookReturnType(apiFile, hook.name);
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
  const hook = apiFile.getFunction(hookName) || apiFile.getVariableDeclaration(hookName);
  if (!hook) return null;

  const type = hook.getType();
  // For React Query hooks, we need to drill down into the UseQueryResult
  const typeText = type.getText();
  if (typeText.includes('UseQueryResult') || typeText.includes('UseMutationResult')) {
    const typeArgs = type.getTypeArguments();
    if (typeArgs.length > 0) {
      return typeArgs[0]; // The TData type
    }
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
