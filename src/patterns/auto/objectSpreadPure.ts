// src/patterns/auto/objectSpreadPure.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ObjectSpreadPurePattern extends AutoPattern {
  readonly name = 'object-spread-pure';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isSpreadInObject = usage.parent?.getKind() === SyntaxKind.SpreadAssignment 
      && usage.grandparent?.getKind() === SyntaxKind.ObjectLiteralExpression
      && usage.transformations.length === 0;

    if (!isSpreadInObject) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'wrap-in-usememo'
    };
  }
}
