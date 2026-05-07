// src/patterns/auto/optionalChain.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class OptionalChainPattern extends AutoPattern {
  readonly name = 'conditional-optional-chain';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    const isOptionalChain = parent?.getKind() === SyntaxKind.PropertyAccessExpression &&
                           (parent.asKind(SyntaxKind.PropertyAccessExpression)?.hasQuestionDotToken());

    if (!isOptionalChain) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'default'
    };
  }
}
