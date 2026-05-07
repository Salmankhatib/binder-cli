// src/patterns/auto/errorFallback.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ErrorFallbackPattern extends AutoPattern {
  readonly name = 'error-fallback';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isErrorFallback = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.IfStatement) {
        const cond = current.asKind(SyntaxKind.IfStatement).getExpression().getText().toLowerCase();
        if (cond.includes('error') || cond.includes('failed') || cond.includes('err')) {
          isErrorFallback = true;
          break;
        }
      }
      current = current.getParent();
    }

    if (!isErrorFallback) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'default'
    };
  }
}
