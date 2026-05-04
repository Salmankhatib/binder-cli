// src/patterns/auto/everySome.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class EverySomePattern extends AutoPattern {
  readonly name = 'every-some';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isEverySome = usage.transformations.length === 1 
      && (usage.transformations[0] === 'every' || usage.transformations[0] === 'some');

    if (!isEverySome) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'default'
    };
  }
}
