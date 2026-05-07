// src/patterns/auto/groupByStatic.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class GroupByStaticPattern extends AutoPattern {
  readonly name = 'group-by-static';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isGroupBy = usage.transformations.includes('groupBy') || usage.transformations.includes('reduce');
    
    if (!isGroupBy || usage.hasConditional) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'wrap-in-usememo'
    };
  }
}
