// src/patterns/auto/simpleFilter.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class SimpleFilterPattern extends AutoPattern {
  readonly name = 'filter-simple';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isFilter = usage.transformations.includes('filter');
    const snippet = usage.node.getParent()?.getText().toLowerCase() || '';
    
    // If it looks like a search query, let human decide. Otherwise, Auto.
    const isSearch = snippet.includes('search') || snippet.includes('query') || snippet.includes('term');

    if (!isFilter || usage.hasConditional || isSearch) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'wrap-in-usememo'
    };
  }
}
