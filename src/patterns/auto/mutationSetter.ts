import { SyntaxKind, Node, Identifier } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class MutationSetterPattern extends AutoPattern {
  readonly name = 'mutation-setter';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    
    // Pattern: setUsers([...users, newItem])
    // id (mock) -> SpreadElement -> ArrayLiteralExpression -> CallExpression (setter)
    
    let isMutation = false;
    let callExpr: Node | undefined;

    if (usage.isMutation) {
        isMutation = true;
        // Find the call expression
        callExpr = usage.node.getFirstAncestorByKind(SyntaxKind.CallExpression);
    }

    if (!isMutation || !callExpr) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    // Heuristic for mutation type
    let strategy = 'default';
    const callText = callExpr.getText();
    
    if (callText.includes('...') && (callText.includes('filter') || callText.includes('delete') || callText.includes('remove'))) {
        strategy = 'mutation-delete';
    } else if (callText.includes('...') && (callText.includes('map') || callText.includes('update') || callText.includes('edit'))) {
        strategy = 'mutation-update';
    } else if (callText.includes('...')) {
        strategy = 'mutation-create';
    }

    return {
      matches: true,
      confidence: 1.0, // High confidence for explicit setters
      strategy: strategy
    };
  }
}
