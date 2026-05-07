// src/patterns/human/cacheInvalidation.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class CacheInvalidationPattern extends HumanPattern {
  readonly name = 'cache-invalidation';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const isMutation = mock.name.match(/delete|remove|update|create|post|put|patch/i);
    const hasSuccessiveCall = usage.isInCallback; // Heuristic: mutations in callbacks often need invalidation

    if (!isMutation || !hasSuccessiveCall) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.65,
      ambiguityType: 'invalidation-strategy'
    };
  }
}
