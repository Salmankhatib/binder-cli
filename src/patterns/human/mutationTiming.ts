// src/patterns/human/mutationTiming.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class MutationTimingPattern extends HumanPattern {
  readonly name = 'mutation-timing';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const isAction = mock.type === 'action_mock' || usage.isInCallback;

    if (!isAction) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.7,
      ambiguityType: 'mutation-timing'
    };
  }
}
