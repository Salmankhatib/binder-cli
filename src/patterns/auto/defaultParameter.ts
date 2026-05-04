// src/patterns/auto/defaultParameter.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class DefaultParameterPattern extends AutoPattern {
  readonly name = 'default-parameter';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    const isDefaultParam = parent?.getKind() === SyntaxKind.Parameter &&
                          parent.asKind(SyntaxKind.Parameter)?.getInitializer()?.getText() === mock.name;

    if (!isDefaultParam) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'default'
    };
  }
}
