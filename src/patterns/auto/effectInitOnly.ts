// src/patterns/auto/effectInitOnly.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class EffectInitOnlyPattern extends AutoPattern {
  readonly name = 'effect-init-only';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isInsideEffect = false;
    let isInitialOnly = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.CallExpression) {
        const call = current.asKind(SyntaxKind.CallExpression);
        if (call.getExpression().getText() === 'useEffect') {
          isInsideEffect = true;
          const args = call.getArguments();
          if (args.length > 1 && args[1].getKind() === SyntaxKind.ArrayLiteralExpression) {
            if (args[1].asKind(SyntaxKind.ArrayLiteralExpression)?.getElements().length === 0) {
              isInitialOnly = true;
            }
          }
          break;
        }
      }
      current = current.getParent();
    }

    if (!isInsideEffect || !isInitialOnly) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'rewrite-effect-init'
    };
  }
}
