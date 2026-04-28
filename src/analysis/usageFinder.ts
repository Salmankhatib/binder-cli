// src/analysis/usageFinder.ts
import { Node, SyntaxKind, Identifier } from 'ts-morph';

export interface UsageContext {
  node: Identifier;
  parent: Node;
  grandparent: Node;
  transformations: string[];
  hasConditional: boolean;
  isInJsx: boolean;
  isInCallback: boolean;
}

export function findAllUsages(mockName: string, sourceFile: any): UsageContext[] {
  const usages: UsageContext[] = [];
  
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id: Identifier) => id.getText() === mockName);
  
  for (const id of identifiers) {
    const parent = id.getParent();
    const grandparent = parent?.getParent();
    
    usages.push({
      node: id,
      parent: parent!,
      grandparent: grandparent!,
      transformations: extractTransformations(id),
      hasConditional: isInConditional(id),
      isInJsx: isInsideJsx(id),
      isInCallback: isInsideCallback(id)
    });
  }
  
  return usages;
}

export function extractTransformations(id: Identifier): string[] {
  const transforms: string[] = [];
  let current = id.getParent();
  
  while (current && Node.isPropertyAccessExpression(current)) {
    transforms.push(current.getName());
    current = current.getParent();
  }
  
  return transforms.reverse();
}

export function isInConditional(id: Identifier): boolean {
  let current = id.getParent();
  while (current) {
    if (Node.isIfStatement(current) || 
        Node.isConditionalExpression(current) ||
        Node.isSwitchStatement(current)) {
      return true;
    }
    current = current.getParent();
  }
  return false;
}

export function isInsideJsx(id: Identifier): boolean {
  let current = id.getParent();
  while (current) {
    if (Node.isJsxElement(current) || Node.isJsxSelfClosingElement(current)) {
      return true;
    }
    current = current.getParent();
  }
  return false;
}

export function isInsideCallback(id: Identifier): boolean {
  let current = id.getParent();
  while (current) {
    if (Node.isArrowFunction(current) || Node.isFunctionExpression(current)) {
      return true;
    }
    current = current.getParent();
  }
  return false;
}

export function isInsideUseQuery(usage: UsageContext): boolean {
  let current: Node | undefined = usage.node.getParent();
  while (current) {
    if (Node.isCallExpression(current)) {
      const expression = current.getExpression();
      if (expression.getText().includes('useQuery')) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

export function hasTransformations(usage: UsageContext): boolean {
  return usage.transformations.length > 0;
}

export function hasConditionalLogic(usage: UsageContext): boolean {
  return usage.hasConditional;
}

export function hasMultipleTransforms(usage: UsageContext): boolean {
  return usage.transformations.length > 1;
}

export function hasNestedAccess(usage: UsageContext): boolean {
  // Check if it's a property access that isn't a known transformation
  const commonTransforms = ['map', 'filter', 'reduce', 'find', 'some', 'every'];
  return usage.transformations.some(t => !commonTransforms.includes(t));
}

export function hasDynamicKey(usage: UsageContext): boolean {
  let current: Node | undefined = usage.node.getParent();
  while (current) {
    if (Node.isElementAccessExpression(current)) {
      return true;
    }
    if (Node.isPropertyAccessExpression(current)) {
      current = current.getParent();
      continue;
    }
    break;
  }
  return false;
}

export function hasSideEffects(usage: UsageContext): boolean {
  let current: Node | undefined = usage.node.getParent();
  while (current) {
    if (Node.isCallExpression(current)) {
      const expression = current.getExpression();
      if (expression.getText() === usage.node.getText()) {
        return true; // MOCK() call
      }
    }
    current = current.getParent();
  }
  return false;
}
