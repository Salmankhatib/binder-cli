// src/patterns/auto/dependencyArray.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class DependencyArrayPattern extends AutoPattern {
  readonly name = 'mock-in-dependency-array';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    let isDependency = false;
    
    if (parent?.getKind() === SyntaxKind.ArrayLiteralExpression) {
      const call = parent.getParent();
      if (call?.getKind() === SyntaxKind.CallExpression) {
        const expr = call.asKind(SyntaxKind.CallExpression)?.getExpression().getText();
        if (expr === 'useEffect' || expr === 'useMemo' || expr === 'useCallback') {
          isDependency = true;
        }
      }
    }

    if (!isDependency) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.75,
      strategy: 'rewrite-memo-deps'
    };
  }
}
