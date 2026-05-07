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
    
    const hook = apiFile.getFunction(bestHook) || 
                 apiFile.getVariableDeclaration(bestHook) ||
                 apiFile.getFunction(bestHook.replace(/\./g, '_')) ||
                 apiFile.getVariableDeclaration(bestHook.replace(/\./g, '_'));
    if (!hook) {
      return {
        score: 5,
        compatibility: 'none',
        explanation: `Hook "${bestHook}" not found in generated API.`
      };
    }

    // Extract return type keys
    let hookType = hook.getType();
    
    // If it's a function, get its return type
    const callSignatures = hookType.getCallSignatures();
    if (callSignatures.length > 0) {
        hookType = callSignatures[0].getReturnType();
    }

    let dataType = hookType;
    const dataProp = hookType.getProperty('data');
    if (dataProp) {
        dataType = project.getTypeChecker().getTypeOfSymbolAtLocation(dataProp, hook.getNameNode());
    }

    // If it's an array, get keys from the element type
    let finalType = dataType;
    if (dataType.isArray()) {
        const elementType = dataType.getArrayElementType();
        if (elementType) finalType = elementType;
    }

    const hookKeys = finalType.getApparentProperties().map(p => p.getName());

    // Fix: If both are arrays of primitives, they are fully compatible
    const isPrimitiveArray = (type: any) => {
        if (!type.isArray()) return false;
        const et = type.getArrayElementType();
        return et && (et.isString() || et.isNumber() || et.isBoolean() || et.getText() === 'any');
    };

    if (isPrimitiveArray(dataType) && (!mock.inferredShape || Object.keys(mock.inferredShape).length === 0)) {
         return {
            score: 20,
            compatibility: 'full',
            explanation: 'Both are arrays of primitives or any. Full match.'
        };
    }

    const mockKeys = Object.keys(mock.inferredShape || {});
    const intersection = mockKeys.filter(k => hookKeys.includes(k));
    const union = Array.from(new Set([...mockKeys, ...hookKeys]));
    let similarity = union.length > 0 ? intersection.length / union.length : 0;

    // BOOST: If both are arrays and mock is plural, boost similarity
    const isMockPlural = mock.name.endsWith('S') || mock.name.includes('LIST') || mock.name.includes('DATA');
    if (dataType.isArray() && isMockPlural) {
        similarity = Math.max(similarity, 0.7);
    }

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
