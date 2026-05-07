// src/patterns/auto/reduceAccumulator.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ReduceAccumulatorPattern extends AutoPattern {
  readonly name = 'reduce-accumulator';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isReduce = usage.transformations.length === 1 
      && usage.transformations[0] === 'reduce';

    if (!isReduce) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'wrap-in-usememo'
    };
  }
}
