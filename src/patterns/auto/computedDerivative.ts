// src/patterns/auto/computedDerivative.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ComputedDerivativePattern extends AutoPattern {
  readonly name = 'computed-derivative';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const allowed = ['filter', 'map', 'sort', 'slice', 'reverse', 'concat', 'find', 'some', 'every', 'reduce'];
    const transforms = usage.transformations || [];
    const isDerivative = transforms.length > 0 && 
                        transforms.every(t => allowed.includes(t)) && 
                        !usage.hasConditional;

    if (!isDerivative) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'wrap-in-usememo'
    };
  }
}
