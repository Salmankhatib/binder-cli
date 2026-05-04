// src/patterns/human/sortStrategy.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class SortStrategyPattern extends HumanPattern {
  readonly name = 'sort-strategy';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const hasSort = usage.transformations.includes('sort');

    if (!hasSort) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.75,
      ambiguityType: 'sort-strategy'
    };
  }
}
