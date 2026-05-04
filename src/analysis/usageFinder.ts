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
