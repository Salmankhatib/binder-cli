// src/patterns/auto/propPassing.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class PropPassingPattern extends AutoPattern {
  readonly name = 'prop-passing';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isJsxProp = (usage.parent?.getKind() === SyntaxKind.JsxExpression || 
                      usage.parent?.getKind() === SyntaxKind.JsxAttribute) &&
                     usage.transformations.length === 0;

    if (!isJsxProp) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'default'
    };
  }
}
