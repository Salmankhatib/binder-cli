// src/patterns/human/filterStrategy.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class FilterStrategyPattern extends HumanPattern {
  readonly name = 'filter-strategy';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const hasFilter = usage.transformations.includes('filter');

    if (!hasFilter) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.75,
      ambiguityType: 'filter-strategy'
    };
  }
}
