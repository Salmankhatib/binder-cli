// src/patterns/auto/includesCheck.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class IncludesCheckPattern extends AutoPattern {
  readonly name = 'includes-check';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isIncludes = usage.transformations.length === 1 
      && usage.transformations[0] === 'includes';

    if (!isIncludes) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'default'
    };
  }
}
