// src/patterns/auto/returnDirect.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ReturnDirectPattern extends AutoPattern {
  readonly name = 'return-direct';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isReturn = usage.parent?.getKind() === SyntaxKind.ReturnStatement ||
                    (usage.parent?.getKind() === SyntaxKind.ArrowFunction && 
                     usage.parent.asKind(SyntaxKind.ArrowFunction)?.getBody().getKind() !== SyntaxKind.Block);

    if (!isReturn) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.9,
      strategy: 'default'
    };
  }
}
