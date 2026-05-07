// src/patterns/todo/classDetection.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { TodoPattern, TodoPatternResult } from './base.js';

export class ClassDetectionPattern extends TodoPattern {
  readonly name = 'class-based-mock';

  test(mock: MockFinding, usage: Usage): TodoPatternResult {
    const parent = usage.node.getParent();
    let isClassInstance = false;
    
    // Check if the mock was initialized with 'new'
    try {
        const decl = usage.node.getSymbol()?.getDeclarations()[0];
        if (decl && Node.isVariableDeclaration(decl)) {
            const init = decl.getInitializer();
            if (init?.getKind() === SyntaxKind.NewExpression) {
                isClassInstance = true;
            }
        }
    } catch (e) {
        // Symbol resolution might fail in tests or isolated environments
    }

    // Check for method calls
    const isMethodCall = parent?.getKind() === SyntaxKind.PropertyAccessExpression && 
                        parent.getParent()?.getKind() === SyntaxKind.CallExpression;

    if (isMethodCall) {
        const methodName = parent.asKind(SyntaxKind.PropertyAccessExpression).getName();
        const safeMethods = ['map', 'filter', 'reduce', 'find', 'some', 'every', 'slice', 'sort', 'includes', 'at', 'concat', 'flat', 'flatMap', 'reverse', 'forEach', 'length'];
        if (safeMethods.includes(methodName)) {
            return { matches: false, confidence: 0, reason: '' };
        }
    }

    if (isClassInstance || isMethodCall) {
        return {
            matches: true,
            confidence: 0.95,
            reason: 'Mock is a class instance or has methods called on it. APIs return plain JSON.'
        };
    }

    return { matches: false, confidence: 0, reason: '' };
  }
}
