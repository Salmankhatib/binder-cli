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
  structuralSignature: string; // The "DNA" of this usage
}

export function findAllUsages(mockName: string, sourceFile: any): UsageContext[] {
  const usages: UsageContext[] = [];
  
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id: Identifier) => id.getText() === mockName);
  
  for (const id of identifiers) {
    const parent = id.getParent();
    
    // Skip the declaration identifier itself
    if (Node.isVariableDeclaration(parent) && parent.getNameNode() === id) {
        continue;
    }
    
    const grandparent = parent?.getParent();
    
    usages.push({
      node: id,
      parent: parent!,
      grandparent: grandparent!,
      transformations: extractTransformations(id),
      hasConditional: isInConditional(id),
      isInJsx: isInsideJsx(id),
      isInCallback: isInsideCallback(id),
      structuralSignature: generateSignature(id)
    });
  }
  
  return usages;
}

export function generateSignature(id: Identifier): string {
  const parent = id.getParent();
  const lineage = id.getAncestors().slice(0, 4).map(a => a.getKindName()).join('>');
  const siblingKinds = parent?.getChildren().map(c => c.getKindName()).join('|') || '';
  
  // This string represents the logical "neighborhood" of the mock
  return `${lineage}[${siblingKinds}]`;
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

export function isEffectDependency(id: Identifier): boolean {
  const parent = id.getParent();
  if (Node.isArrayLiteralExpression(parent)) {
    const grandParent = parent.getParent();
    return Node.isCallExpression(grandParent) && 
           grandParent.getExpression().getText() === 'useEffect';
  }
  return false;
}

export function isConditionalOperand(id: Identifier): boolean {
  const parent = id.getParent();
  return Node.isConditionalExpression(parent);
}

export function findComponentBody(node: Node): Node | null {
  let current: Node | undefined = node;
  while (current) {
    if (Node.isBlock(current)) {
      const parent = current.getParent();
      if (Node.isArrowFunction(parent) || Node.isFunctionExpression(parent) || Node.isFunctionDeclaration(parent)) {
        return current;
      }
    }
    current = current.getParent();
  }
  return null;
}

export function hasComputedProperties(node: Node): boolean {
  if (Node.isSpreadAssignment(node)) {
    const parent = node.getParent();
    if (Node.isObjectLiteralExpression(parent)) {
      return parent.getProperties().some(p => Node.isComputedPropertyName(p));
    }
  }
  return false;
}

export function hasSetterUsage(mockName: string, sourceFile: any): boolean {
  // Find useState call where mockName is used as init
  const useStateCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call: any) => {
      const expr = call.getExpression();
      return expr.getText() === 'useState' && 
             call.getArguments().some((arg: any) => arg.getText() === mockName);
    });

  for (const call of useStateCalls) {
    const parent = call.getParent();
    if (Node.isVariableDeclaration(parent)) {
      const nameNode = parent.getNameNode();
      if (Node.isArrayBindingPattern(nameNode)) {
        const elements = nameNode.getElements();
        if (elements.length >= 2) {
          const setterNode = elements[1];
          if (Node.isBindingElement(setterNode)) {
            const setterName = setterNode.getName();
            // Check if this setter is used anywhere else in the file
            const usages = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
              .filter((id: Identifier) => id.getText() === setterName);
            if (usages.length > 1) return true; // Used more than once (declaration + usage)
          }
        }
      }
    }
  }
  return false;
}
