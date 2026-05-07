// src/patterns/auto/alreadyGuarded.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class AlreadyGuardedPattern extends AutoPattern {
  readonly name = 'already-guarded-component';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isGuarded = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.IfStatement) {
        const cond = current.asKind(SyntaxKind.IfStatement).getExpression().getText().toLowerCase();
        if (cond.includes('loading') || cond.includes('fetching') || cond.includes('error')) {
          isGuarded = true;
          break;
        }
      }
      current = current.getParent();
    }

    if (!isGuarded) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'default' // Just swap the data source
    };
  }
}
