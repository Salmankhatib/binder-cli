// src/patterns/auto/destructuredAssignment.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class DestructuredAssignmentPattern extends AutoPattern {
  readonly name = 'destructured-assignment';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isDestructured = (usage.parent?.getKind() === SyntaxKind.VariableDeclaration 
      && (usage.parent.asKind(SyntaxKind.VariableDeclaration)?.getNameNode().getKind() === SyntaxKind.ObjectBindingPattern || 
          usage.parent.asKind(SyntaxKind.VariableDeclaration)?.getNameNode().getKind() === SyntaxKind.ArrayBindingPattern))
      || (usage.parent?.getKind() === SyntaxKind.BindingElement);

    if (!isDestructured) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 1.0,
      strategy: 'destructure-from-hook'
    };
  }
}
