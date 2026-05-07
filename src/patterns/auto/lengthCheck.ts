// src/patterns/auto/lengthCheck.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class LengthCheckPattern extends AutoPattern {
  readonly name = 'length-check';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isLengthCheck = usage.transformations.length === 1 
      && usage.transformations[0] === 'length';

    if (!isLengthCheck) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.95,
      strategy: 'default'
    };
  }
}
