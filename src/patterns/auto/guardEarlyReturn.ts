// src/patterns/auto/guardEarlyReturn.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class GuardEarlyReturnPattern extends AutoPattern {
  readonly name = 'guard-early-return';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isGuard = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.IfStatement) {
        const ifStmt = current.asKind(SyntaxKind.IfStatement);
        const thenStatement = ifStmt.getThenStatement();
        const hasReturn = thenStatement.getKind() === SyntaxKind.ReturnStatement || 
                         thenStatement.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;
        if (hasReturn) {
          isGuard = true;
        }
        break;
      }
      current = current.getParent();
    }

    if (!isGuard) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 1.0,
      strategy: 'guard-by-loading'
    };
  }
}
