// src/patterns/auto/jsxPropDirect.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class JsxPropDirectPattern extends AutoPattern {
  readonly name = 'jsx-prop-direct';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isDirectJsx = usage.isInJsx && usage.transformations.length <= 1;

    if (!isDirectJsx) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'default'
    };
  }
}
