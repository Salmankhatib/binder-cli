import { Node, SyntaxKind, Identifier } from 'ts-morph';
import { UsageContext } from './usageFinder.js';

export type UsagePattern = 
  | 'useState-init' 
  | 'useEffect-dep' 
  | 'prop-pass' 
  | 'method-call' 
  | 'spread-operator' 
  | 'conditional-check' 
  | 'render-only' 
  | 'imperative-dom'
  | 'derived-data';

export interface UsageProfile {
  patterns: UsagePattern[];
  isDangerous: boolean;
  explanation: string[];
}

export function analyzeUsage(usages: UsageContext[]): UsageProfile {
  const patterns = new Set<UsagePattern>();
  const explanations: string[] = [];

  for (const usage of usages) {
    const parent = usage.node.getParent();
    
    // 1. useState initialization
    if (parent?.getKind() === SyntaxKind.CallExpression) {
      const callExpr = parent.asKind(SyntaxKind.CallExpression);
      const exprText = callExpr.getExpression().getText();
      if (exprText === 'useState') {
        patterns.add('useState-init');
        explanations.push('Mock is used as useState() initializer.');
      }
    }

    // 1.5 Object spread into state or similar
    if (parent?.getKind() === SyntaxKind.ObjectLiteralExpression || parent?.getKind() === SyntaxKind.ArrayLiteralExpression) {
        const grandParent = parent.getParent();
        if (grandParent?.getKind() === SyntaxKind.CallExpression && 
            grandParent.asKind(SyntaxKind.CallExpression)?.getExpression().getText() === 'useState') {
            patterns.add('useState-init');
            explanations.push('Mock is spread into a useState() initializer.');
        }
    }

    // 2. useEffect dependencies
    const dependencyArray = usage.node.getFirstAncestorByKind(SyntaxKind.ArrayLiteralExpression);
    if (dependencyArray) {
      const call = dependencyArray.getParent();
      if (call?.getKind() === SyntaxKind.CallExpression) {
        const callName = (call as any).getExpression().getText();
        if (callName === 'useEffect' || callName === 'useMemo' || callName === 'useCallback') {
          patterns.add('useEffect-dep');
          explanations.push(`Mock is a dependency in a ${callName} hook.`);
        }
      }
    }

    // 3. Prop passing
    if (parent?.getKind() === SyntaxKind.JsxAttribute) {
        // Direct attribute passing: <Comp user={MOCK_USER} />
        patterns.add('prop-pass');
        explanations.push('Mock is passed as a JSX attribute.');
    } else if (parent?.getKind() === SyntaxKind.JsxExpression && !Node.isPropertyAccessExpression(usage.node.getParent())) {
        // If it's a direct identifier in a JsxExpression, e.g. {MOCK_USER}
        // but ONLY if it's not inside a map callback or similar
        const isCallbackParam = usage.node.getFirstAncestorByKind(SyntaxKind.ArrowFunction) || 
                               usage.node.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
        
        if (!isCallbackParam) {
            patterns.add('prop-pass');
            explanations.push('Mock is passed directly into a JSX expression.');
        }
    }

    // 4. Method calls (class or object methods)
    if (usage.node.getParent()?.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = usage.node.getParent()?.asKind(SyntaxKind.PropertyAccessExpression);
        if (propAccess?.getParent()?.getKind() === SyntaxKind.CallExpression) {
            const methodName = propAccess.getName();
            const safeMethods = ['map', 'filter', 'reduce', 'find', 'some', 'every', 'slice', 'sort', 'includes', 'at', 'concat', 'flat', 'flatMap', 'reverse', 'forEach'];
            
            if (!safeMethods.includes(methodName)) {
                patterns.add('method-call');
                explanations.push(`Mock has custom method call: .${methodName}() (APIs return data, not behavior).`);
            }
        }
    }

    // 5. Spread operator
    if (parent?.getKind() === SyntaxKind.SpreadAssignment || parent?.getKind() === SyntaxKind.SpreadElement) {
        patterns.add('spread-operator');
        explanations.push('Mock is used with a spread operator.');
    }

    // 6. Conditional checks
    if (usage.hasConditional) {
        patterns.add('conditional-check');
        explanations.push('Mock is used within conditional logic (if/ternary/switch).');
    }

    // 7. Imperative DOM
    const effect = usage.node.getFirstAncestor(a => Node.isCallExpression(a) && a.getExpression().getText() === 'useEffect');
    if (effect) {
        const text = effect.getText();
        if (text.includes('canvas') || text.includes('document.') || text.includes('window.') || text.includes('Ref.current')) {
            patterns.add('imperative-dom');
            explanations.push('Mock is used inside an effect with imperative DOM manipulation.');
        }
    }

    // 8. Derived Data Chains
    if (usage.transformations.length > 1) {
        patterns.add('derived-data');
        explanations.push('Mock is part of a derived data chain (.filter().map() etc).');
    }

    // 9. Mutation Pattern
    if (usage.isMutation) {
        patterns.add('mutation-setter');
        explanations.push('Mock is used in a state setter/mutation pattern.');
    }
  }

  const hasComplexPattern = patterns.has('useState-init') || 
                           patterns.has('useEffect-dep') || 
                           patterns.has('prop-pass') || 
                           patterns.has('method-call') || 
                           patterns.has('imperative-dom') ||
                           patterns.has('derived-data');

  if (!hasComplexPattern && usages.length > 0) {
    patterns.add('render-only');
  }

  const dangerousPatterns: UsagePattern[] = ['useState-init', 'useEffect-dep', 'method-call', 'imperative-dom'];
  let isDangerous = Array.from(patterns).some(p => dangerousPatterns.includes(p));

  // If it's a known handled pattern, it's not "dangerous" for auto-binding anymore
  if (patterns.has('mutation-setter') || patterns.has('subscription-refresh')) {
      isDangerous = false;
  }

  return {
    patterns: Array.from(patterns),
    isDangerous,
    explanation: Array.from(new Set(explanations))
  };
}
