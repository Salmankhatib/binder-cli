// src/patterns/auto/deterministicTransforms.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class DeterministicTransformsPattern extends AutoPattern {
  readonly name = 'deterministic-transforms';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const allowed = ['filter', 'sort', 'slice', 'reverse', 'concat', 'find'];
    const transforms = usage.transformations || [];
    const matches = transforms.length > 0 && 
           transforms.every(t => allowed.includes(t)) && 
           !usage.hasConditional;

    if (!matches) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'wrap-in-usememo'
    };
  }
}
