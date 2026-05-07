// src/patterns/auto/useCallbackParam.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class UseCallbackParamPattern extends AutoPattern {
  readonly name = 'usecallback-param';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    let current = usage.node.getParent();
    let isInsideUseCallback = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.CallExpression && 
          current.asKind(SyntaxKind.CallExpression)?.getExpression().getText() === 'useCallback') {
        isInsideUseCallback = true;
        break;
      }
      current = current.getParent();
    }

    if (!isInsideUseCallback) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'rewrite-callback-deps'
    };
  }
}
