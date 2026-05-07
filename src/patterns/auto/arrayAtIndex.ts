// src/patterns/auto/arrayAtIndex.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ArrayAtIndexPattern extends AutoPattern {
  readonly name = 'array-at-index';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    const isIndexAccess = parent?.getKind() === SyntaxKind.ElementAccessExpression;
    const isAtCall = usage.transformations.includes('at');

    if (!isIndexAccess && !isAtCall) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'default'
    };
  }
}
