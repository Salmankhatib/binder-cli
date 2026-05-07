// src/patterns/auto/formDefaults.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class FormDefaultsPattern extends AutoPattern {
  readonly name = 'form-defaults';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    const isUseStateInit = parent?.getKind() === SyntaxKind.CallExpression &&
           parent.asKind(SyntaxKind.CallExpression)?.getExpression().getText() === 'useState';

    if (!isUseStateInit) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'lazy-initialize'
    };
  }
}
