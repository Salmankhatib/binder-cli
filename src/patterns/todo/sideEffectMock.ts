// src/patterns/todo/sideEffectMock.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { TodoPattern, TodoPatternResult } from './base.js';

export class SideEffectMockPattern extends TodoPattern {
  readonly name = 'side-effect-mock';

  test(mock: MockFinding, usage: Usage): TodoPatternResult {
    // Detect if mock is used inside an effect that performs manual DOM manipulation or global state changes
    let isRisky = false;
    let current: Node | undefined = usage.node.getParent();
    
    while (current) {
      if (current.getKind() === SyntaxKind.CallExpression) {
        const text = current.getText();
        if (text.includes('useEffect') && (text.includes('document.') || text.includes('window.') || text.includes('localStorage'))) {
          isRisky = true;
          break;
        }
      }
      current = current.getParent();
    }

    return {
      matches: isRisky,
      confidence: 0.9,
      reason: 'Mock triggers global side effects in useEffect.'
    };
  }
}
