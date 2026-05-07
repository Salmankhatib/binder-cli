// src/patterns/human/propDrillShallow.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class PropDrillShallowPattern extends HumanPattern {
  readonly name = 'prop-drill-shallow';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    const isPropPassing = usage.parent?.getKind() === SyntaxKind.JsxAttribute 
      || usage.parent?.getKind() === SyntaxKind.JsxExpression;

    if (!isPropPassing) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.8,
      ambiguityType: 'prop-drill'
    };
  }
}
