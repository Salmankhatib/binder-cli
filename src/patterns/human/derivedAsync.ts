// src/patterns/human/derivedAsync.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class DerivedAsyncPattern extends HumanPattern {
  readonly name = 'derived-async';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isAsync = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.ArrowFunction || current.getKind() === SyntaxKind.FunctionExpression) {
        if (current.asKind(SyntaxKind.ArrowFunction)?.isAsync() || current.asKind(SyntaxKind.FunctionExpression)?.isAsync()) {
          isAsync = true;
          break;
        }
      }
      current = current.getParent();
    }

    if (!isAsync) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.7,
      ambiguityType: 'async-strategy'
    };
  }
}
