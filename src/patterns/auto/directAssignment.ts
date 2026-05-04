// src/patterns/auto/directAssignment.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class DirectAssignmentPattern extends AutoPattern {
  readonly name = 'direct-assignment';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isDirectAssignment = usage.parent?.getKind() === SyntaxKind.VariableDeclaration 
      && usage.transformations.length === 0
      && !usage.hasConditional;

    if (!isDirectAssignment) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.95,
      strategy: 'default'
    };
  }
}
