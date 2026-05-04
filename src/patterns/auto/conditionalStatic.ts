// src/patterns/auto/conditionalStatic.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ConditionalStaticPattern extends AutoPattern {
  readonly name = 'conditional-static';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isConditional = usage.parent?.getKind() === SyntaxKind.ConditionalExpression ||
                         usage.parent?.getKind() === SyntaxKind.BinaryExpression;

    if (!isConditional || usage.transformations.length > 0) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'conditional-static'
    };
  }
}
