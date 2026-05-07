// src/patterns/todo/performanceCritical.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { TodoPattern, TodoPatternResult } from './base.js';

export class PerformanceCriticalPattern extends TodoPattern {
  readonly name = 'performance-critical';

  test(mock: MockFinding, usage: Usage): TodoPatternResult {
    // Detect if mock is used inside a loop or a high-frequency event handler
    let isPerformanceCritical = false;
    let current: Node | undefined = usage.node.getParent();
    
    while (current) {
      if (current.getKind() === SyntaxKind.ForStatement || 
          current.getKind() === SyntaxKind.WhileStatement ||
          current.getKind() === SyntaxKind.DoStatement ||
          current.getKind() === SyntaxKind.ForInStatement ||
          current.getKind() === SyntaxKind.ForOfStatement) {
        isPerformanceCritical = true;
        break;
      }
      
      const text = current.getText();
      if (text.includes('onMouseMove') || text.includes('onScroll') || text.includes('requestAnimationFrame')) {
        isPerformanceCritical = true;
        break;
      }
      
      current = current.getParent();
    }

    return {
      matches: isPerformanceCritical,
      confidence: 0.85,
      reason: 'Mock used in a performance-sensitive loop or event.'
    };
  }
}
