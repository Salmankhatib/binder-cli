// src/patterns/auto/computedChain.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ComputedChainPattern extends AutoPattern {
  readonly name = 'computed-chain';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const allowed = ['filter', 'map', 'sort', 'slice', 'reverse', 'concat', 'find', 'reduce', 'some', 'every'];
    const transforms = usage.transformations || [];
    const isChain = transforms.length >= 2 && 
                   transforms.every(t => allowed.includes(t)) && 
                   !usage.hasConditional;

    if (!isChain) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'wrap-in-usememo'
    };
  }
}
