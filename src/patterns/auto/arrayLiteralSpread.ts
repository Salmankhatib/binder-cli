// src/patterns/auto/arrayLiteralSpread.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ArrayLiteralSpreadPattern extends AutoPattern {
  readonly name = 'array-literal-spread';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isSpreadInArray = usage.parent?.getKind() === SyntaxKind.SpreadElement 
      && usage.grandparent?.getKind() === SyntaxKind.ArrayLiteralExpression
      && usage.transformations.length === 0;

    if (!isSpreadInArray) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'wrap-in-usememo'
    };
  }
}
