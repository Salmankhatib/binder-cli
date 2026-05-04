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
        if (thenStatement.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0) {
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
      confidence: 0.85,
      strategy: 'guard-by-loading'
    };
  }
}
