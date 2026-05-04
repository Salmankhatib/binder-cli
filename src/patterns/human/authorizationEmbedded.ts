// src/patterns/human/authorizationEmbedded.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class AuthorizationEmbeddedPattern extends HumanPattern {
  readonly name = 'authorization-embedded';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isAuth = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.IfStatement) {
        const cond = current.asKind(SyntaxKind.IfStatement).getExpression().getText().toLowerCase();
        if (cond.includes('user') || cond.includes('role') || cond.includes('admin') || cond.includes('permission') || cond.includes('auth')) {
          isAuth = true;
          break;
        }
      }
      current = current.getParent();
    }

    if (!isAuth) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.7,
      ambiguityType: 'auth-strategy'
    };
  }
}
