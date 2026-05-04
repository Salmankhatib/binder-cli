// src/patterns/auto/safeSpreadProps.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class SafeSpreadPropsPattern extends AutoPattern {
  readonly name = 'safe-spread-props';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isSpreadInJsx = usage.parent?.getKind() === SyntaxKind.JsxSpreadAttribute;

    if (!isSpreadInJsx) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'default'
    };
  }
}
