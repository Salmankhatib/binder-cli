// src/patterns/human/multiSourceMerge.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class MultiSourceMergePattern extends HumanPattern {
  readonly name = 'multi-source-merge';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const parent = usage.parent;
    const isMerge = parent?.getKind() === SyntaxKind.ArrayLiteralExpression || 
                   parent?.getKind() === SyntaxKind.ObjectLiteralExpression ||
                   usage.transformations.includes('concat');

    if (!isMerge) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    // Check if other elements in the merge are also mocks (heuristic)
    const text = parent?.getText() || '';
    const mockCount = (text.match(/MOCK_|FAKE_|STUB_/g) || []).length;

    if (mockCount < 2) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.75,
      ambiguityType: 'merge-strategy'
    };
  }
}
