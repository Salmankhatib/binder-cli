// src/engine/scoring/typeScorer.ts
import { MockFinding, Usage } from '../types.js';
import { Project, Type } from 'ts-morph';

export interface TypeScoreResult {
  score: number;
  compatibility: 'full' | 'partial' | 'none' | 'unknown';
  explanation: string;
}

export class TypeScorer {
  score(mock: MockFinding, usages: Usage[], apiContent: string, bestHook: string): TypeScoreResult {
    if (!mock.inferredShape || !bestHook) {
      return {
        score: 10,
        compatibility: 'unknown',
        explanation: 'No shape inference available. Neutral score.'
      };
    }

    const project = new Project({ useInMemoryFileSystem: true });
    const apiFile = project.createSourceFile('api.ts', apiContent);
    
    const hook = apiFile.getFunction(bestHook) || apiFile.getVariableDeclaration(bestHook);
    if (!hook) {
      return {
        score: 5,
        compatibility: 'none',
        explanation: `Hook "${bestHook}" not found in generated API.`
      };
    }

    // Extract return type keys
    const hookType = hook.getType();
    const typeText = hookType.getText();
    let dataType = hookType;
    
    if (typeText.includes('UseQueryResult') || typeText.includes('UseMutationResult')) {
      const typeArgs = hookType.getTypeArguments();
      if (typeArgs.length > 0) dataType = typeArgs[0];
    }

    const hookKeys = dataType.isArray() 
      ? this.extractKeysFromArray(dataType)
      : dataType.getApparentProperties().map(p => p.getName());

    const mockKeys = Object.keys(mock.inferredShape);
    const intersection = mockKeys.filter(k => hookKeys.includes(k));
    const union = Array.from(new Set([...mockKeys, ...hookKeys]));
    const similarity = union.length > 0 ? intersection.length / union.length : 0;

    if (similarity > 0.8) {
      return {
        score: 20,
        compatibility: 'full',
        explanation: `Type compatibility: ${intersection.length}/${union.length} keys match (${(similarity * 100).toFixed(0)}%)`
      };
    }

    if (similarity > 0.5) {
      return {
        score: 12,
        compatibility: 'partial',
        explanation: `Partial compatibility: ${intersection.length}/${union.length} keys. Shape remapper may be needed.`
      };
    }

    return {
      score: 5,
      compatibility: 'none',
      explanation: `Poor compatibility: ${intersection.length}/${union.length} keys. Manual review recommended.`
    };
  }

  private extractKeysFromArray(type: Type): string[] {
    const elementType = type.getArrayElementType();
    if (!elementType) return [];
    return elementType.getApparentProperties().map(p => p.getName());
  }
}
