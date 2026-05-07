// src/patterns/auto/mergeHooks.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class MergeHooksPattern extends AutoPattern {
  readonly name = 'merge-hooks';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.parent;
    const isMerge = parent?.getKind() === SyntaxKind.ArrayLiteralExpression || 
                   parent?.getKind() === SyntaxKind.ObjectLiteralExpression;

    if (!isMerge) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    const text = parent?.getText() || '';
    const mockCount = (text.match(/MOCK_|FAKE_|STUB_/g) || []).length;

    // If it's a simple merge of multiple mocks, we can merge the hooks later
    if (mockCount < 2) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'merge-hooks'
    };
  }
}
