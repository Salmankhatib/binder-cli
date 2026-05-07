// src/patterns/human/searchStrategy.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class SearchStrategyPattern extends HumanPattern {
  readonly name = 'search-strategy';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    // Look for filter transformation combined with a search-like variable or includes
    const hasFilter = usage.transformations.includes('filter');
    const snippet = usage.node.getParent()?.getText() || '';
    const isSearch = hasFilter && (snippet.includes('search') || snippet.includes('query') || snippet.includes('term'));

    if (!isSearch) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.75, // Lowered from 0.8
      ambiguityType: 'search-strategy'
    };
  }
}
