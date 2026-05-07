// src/patterns/auto/useMemoDependency.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class UseMemoDependencyPattern extends AutoPattern {
  readonly name = 'usememo-dependency';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    let isDependency = false;
    
    if (parent?.getKind() === SyntaxKind.ArrayLiteralExpression) {
      const call = parent.getParent();
      if (call?.getKind() === SyntaxKind.CallExpression) {
        const expr = call.asKind(SyntaxKind.CallExpression)?.getExpression().getText();
        if (expr === 'useMemo' || expr === 'useEffect' || expr === 'useCallback') {
          isDependency = true;
        }
      }
    }

    if (!isDependency) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'rewrite-memo-deps'
    };
  }
}
