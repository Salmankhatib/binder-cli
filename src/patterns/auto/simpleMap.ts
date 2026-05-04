// src/patterns/auto/simpleMap.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class SimpleMapPattern extends AutoPattern {
  readonly name = 'simple-map';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const transforms = usage.transformations;
    const isSimpleMap = transforms.length === 1 && 
           transforms[0] === 'map' &&
           !usage.hasConditional;

    if (!isSimpleMap) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'default'
    };
  }
}
