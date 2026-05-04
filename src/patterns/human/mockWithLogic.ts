// src/patterns/human/mockWithLogic.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class MockWithLogicPattern extends HumanPattern {
  readonly name = 'mock-with-logic';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const isComplex = usage.transformations.length > 2 || usage.hasConditional;

    if (!isComplex) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.6,
      ambiguityType: 'complex-logic'
    };
  }
}
