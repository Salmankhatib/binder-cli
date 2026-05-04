// src/patterns/auto/loadingFallback.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class LoadingFallbackPattern extends AutoPattern {
  readonly name = 'loading-fallback';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isLoadingFallback = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.IfStatement) {
        const cond = current.asKind(SyntaxKind.IfStatement).getExpression().getText().toLowerCase();
        if (cond.includes('loading') || cond.includes('fetching') || cond.includes('pending')) {
          isLoadingFallback = true;
          break;
        }
      }
      current = current.getParent();
    }

    if (!isLoadingFallback) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'default'
    };
  }
}
