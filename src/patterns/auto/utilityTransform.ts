// src/patterns/auto/utilityTransform.ts
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class UtilityTransformPattern extends AutoPattern {
  readonly name = 'utility-transform';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const utils = ['uniqBy', 'groupBy', 'orderBy', 'sortBy', 'flatten', 'compact', 'pick', 'omit'];
    const transforms = usage.transformations || [];
    
    // Check if any transformation is a common utility or if usage.node is an argument to such utility
    const isUtil = transforms.some(t => utils.includes(t));
    
    // Also check if usage.node is passed to a function named like one of these
    let isArg = false;
    const parent = usage.node.getParent();
    if (parent?.getKind() === import('ts-morph').SyntaxKind.CallExpression) {
        const text = parent.asKind(import('ts-morph').SyntaxKind.CallExpression)?.getExpression().getText();
        if (utils.some(u => text?.includes(u))) {
            isArg = true;
        }
    }

    if (!isUtil && !isArg) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'wrap-in-usememo'
    };
  }
}
