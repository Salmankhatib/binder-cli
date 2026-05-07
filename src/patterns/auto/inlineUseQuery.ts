// src/patterns/auto/inlineUseQuery.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class InlineUseQueryPattern extends AutoPattern {
  readonly name = 'inline-usequery';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    // Check if usage is inside a useQuery call
    let current = usage.node.getParent();
    let isInside = false;
    while (current) {
        if (current.getKind() === SyntaxKind.CallExpression && 
            current.asKind(SyntaxKind.CallExpression)?.getExpression().getText().includes('useQuery')) {
            isInside = true;
            break;
        }
        current = current.getParent();
    }

    if (!isInside || usage.hasConditional || usage.transformations.length > 0) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'default'
    };
  }
}
