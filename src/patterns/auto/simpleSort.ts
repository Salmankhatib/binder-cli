// src/patterns/auto/simpleSort.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class SimpleSortPattern extends AutoPattern {
  readonly name = 'sort-immutable';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isSort = usage.transformations.length === 1 && usage.transformations[0] === 'sort';
    
    if (!isSort || usage.hasConditional) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'wrap-in-usememo'
    };
  }
}
