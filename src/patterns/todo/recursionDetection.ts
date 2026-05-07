// src/patterns/todo/recursionDetection.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { TodoPattern, TodoPatternResult } from './base.js';

export class RecursionDetectionPattern extends TodoPattern {
  readonly name = 'recursion-detected';

  test(mock: MockFinding, usage: Usage): TodoPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isInsideRecursion = false;
    
    while (current) {
      if (current.getKind() === SyntaxKind.FunctionDeclaration || 
          (current.getKind() === SyntaxKind.VariableDeclaration && (current as any).getInitializer()?.getKind() === SyntaxKind.ArrowFunction)) {
        
        const name = (current as any).getName?.() || 
                    (current.getKind() === SyntaxKind.VariableDeclaration ? (current as any).getNameNode().getText() : '');
        
        if (name) {
            let body: Node | undefined;
            if (Node.isFunctionDeclaration(current)) {
                body = current.getBody();
            } else if (Node.isVariableDeclaration(current)) {
                const init = current.getInitializer();
                if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
                    body = init.getBody();
                }
            }

            if (body) {
                // Precise check: is there a CallExpression to 'name' inside 'body'?
                const calls = body.getDescendantsOfKind(SyntaxKind.CallExpression);
                if (calls.some((c: any) => c.getExpression().getText() === name)) {
                    isInsideRecursion = true;
                    break;
                }
            }
        }
      }
      current = current.getParent();
    }

    return {
      matches: isInsideRecursion,
      confidence: 0.95,
      reason: 'Mock is used inside a recursive function.'
    };
  }
}
