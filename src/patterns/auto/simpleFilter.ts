// src/patterns/auto/simpleFilter.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class SimpleFilterPattern extends AutoPattern {
  readonly name = 'filter-simple';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isFilter = usage.transformations.length === 1 && usage.transformations[0] === 'filter';
    
    if (!isFilter || usage.hasConditional) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'wrap-in-usememo'
    };
  }
}
