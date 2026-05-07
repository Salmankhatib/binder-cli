// src/patterns/auto/subscriptionRefresh.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class SubscriptionRefreshPattern extends AutoPattern {
  readonly name = 'subscription-refresh';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    // Detect if mock is used inside a setInterval/setTimeout callback that refreshes data
    let current: Node | undefined = usage.node.getParent();
    let isInsideInterval = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.CallExpression) {
        const text = current.getText();
        if (text.includes('setInterval') || text.includes('setTimeout') || text.includes('socket.on')) {
          isInsideInterval = true;
          break;
        }
      }
      current = current.getParent();
    }

    if (!isInsideInterval) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'subscription-bind'
    };
  }
}
