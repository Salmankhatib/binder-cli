// src/patterns/auto/ternaryPure.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class TernaryPurePattern extends AutoPattern {
  readonly name = 'ternary-pure';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isTernary = usage.parent?.getKind() === SyntaxKind.ConditionalExpression 
      && usage.transformations.length === 0;

    if (!isTernary) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'wrap-in-usememo'
    };
  }
}
