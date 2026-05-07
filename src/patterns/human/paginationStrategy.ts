// src/patterns/human/paginationStrategy.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class PaginationStrategyPattern extends HumanPattern {
  readonly name = 'pagination-strategy';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const hasSlice = usage.transformations.includes('slice');

    if (!hasSlice) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.75,
      ambiguityType: 'pagination-strategy'
    };
  }
}
