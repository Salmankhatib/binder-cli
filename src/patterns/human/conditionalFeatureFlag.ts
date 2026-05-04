// src/patterns/human/conditionalFeatureFlag.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class ConditionalFeatureFlagPattern extends HumanPattern {
  readonly name = 'conditional-feature-flag';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isFeatureFlag = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.IfStatement) {
        const cond = current.asKind(SyntaxKind.IfStatement).getExpression().getText().toLowerCase();
        if (cond.includes('flag') || cond.includes('feature') || cond.includes('enabled')) {
          isFeatureFlag = true;
          break;
        }
      }
      current = current.getParent();
    }

    if (!isFeatureFlag) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.75,
      ambiguityType: 'feature-flag-strategy'
    };
  }
}
