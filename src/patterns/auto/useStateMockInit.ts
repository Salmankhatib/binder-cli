// src/patterns/auto/useStateMockInit.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class UseStateMockInitPattern extends AutoPattern {
  readonly name = 'usestate-mock-init-no-setter';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    const isUseStateInit = parent?.getKind() === SyntaxKind.CallExpression &&
           parent.asKind(SyntaxKind.CallExpression)?.getExpression().getText() === 'useState';

    if (!isUseStateInit) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    // Heuristic: check if the setter is used (if we have access to the file or via analysis)
    // If it's a mock init, we want to migrate it to useQuery
    return {
      matches: true,
      confidence: 0.85,
      strategy: 'migrate-to-usequery'
    };
  }
}
