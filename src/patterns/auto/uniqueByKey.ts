// src/patterns/auto/uniqueByKey.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class UniqueByKeyPattern extends AutoPattern {
  readonly name = 'unique-by-key';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isUniq = usage.transformations.includes('uniqBy') || usage.transformations.includes('uniqueBy');
    
    if (!isUniq || usage.hasConditional) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'wrap-in-usememo'
    };
  }
}
