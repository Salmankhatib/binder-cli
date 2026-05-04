// src/patterns/auto/findById.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class FindByIdPattern extends AutoPattern {
  readonly name = 'find-by-id';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isFind = usage.transformations.includes('find');

    if (!isFind) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'wrap-in-usememo'
    };
  }
}
