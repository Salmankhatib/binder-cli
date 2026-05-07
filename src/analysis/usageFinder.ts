// src/analysis/usageFinder.ts
import { Node, SyntaxKind, Identifier } from 'ts-morph';

export interface UsageContext {
  node: Identifier;
  parent: Node;
  grandparent: Node;
  transformations: string[];
  transformationExpression?: string; // The actual code chain: .filter(...).map(...)
  hasConditional: boolean;
  isInJsx: boolean;
  isInCallback: boolean;
  isMutation: boolean; // NEW: true if it looks like a setter call or data modification
  structuralSignature: string; // The "DNA" of this usage
}

export function findAllUsages(mockName: string, sourceFile: any): UsageContext[] {
  const usages: UsageContext[] = [];
  const processedIdentifiers = new Set<Identifier>();
  const queue: Identifier[] = [];

  // Find initial mock occurrences
  const initial = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id: Identifier) => id.getText() === mockName);
  
  queue.push(...initial);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (processedIdentifiers.has(id)) continue;
    processedIdentifiers.add(id);

    const parent = id.getParent();
    
    // 1. Trace assignments: const data = MOCK; -> follow 'data'
    if (Node.isVariableDeclaration(parent) && parent.getInitializer() === id) {
        const nameNode = parent.getNameNode();
        if (Node.isIdentifier(nameNode)) {
            // Follow references of the new variable
            const refs = nameNode.findReferencesAsNodes().filter(r => Node.isIdentifier(r)) as Identifier[];
            queue.push(...refs);
        } else if (Node.isObjectBindingPattern(nameNode) || Node.isArrayBindingPattern(nameNode)) {
            // Destructuring: follow each element
            nameNode.getElements().forEach(el => {
                const innerName = Node.isBindingElement(el) ? el.getNameNode() : null;
                if (innerName && Node.isIdentifier(innerName)) {
                    const refs = innerName.findReferencesAsNodes().filter(r => Node.isIdentifier(r)) as Identifier[];
                    queue.push(...refs);
                }
            });
        }
        continue; 
    }

    // 1.5 Trace useState: const [data, setData] = useState(MOCK) -> follow 'setData'
    if (Node.isCallExpression(parent) && parent.getExpression().getText() === 'useState') {
        const varDecl = parent.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
        if (varDecl) {
            const nameNode = varDecl.getNameNode();
            if (Node.isArrayBindingPattern(nameNode)) {
                const elements = nameNode.getElements();
                // element[0] is the data, element[1] is the setter
                elements.forEach((el, index) => {
                    const node = Node.isBindingElement(el) ? el.getNameNode() : null;
                    if (node && Node.isIdentifier(node)) {
                        const refs = node.findReferencesAsNodes().filter(r => Node.isIdentifier(r)) as Identifier[];
                        queue.push(...refs);
                    }
                });
            }
        }
    }

    // 2. Skip the declaration of the mock itself (if local)
    if (Node.isVariableDeclaration(parent) && parent.getNameNode() === id) {
        continue;
    }

    const grandparent = parent?.getParent();
    
    usages.push({
      node: id,
      parent: parent!,
      grandparent: grandparent!,
      transformations: extractTransformations(id),
      transformationExpression: extractTransformationExpression(id),
      hasConditional: isInConditional(id),
      isInJsx: isInsideJsx(id),
      isInCallback: isInsideCallback(id),
      isMutation: isMutationPattern(id),
      structuralSignature: generateSignature(id)
    });
  }
  
  return usages;
}

export function isMutationPattern(id: Identifier): boolean {
    const parent = id.getParent();
    
    // 1. useState setter pattern: setUsers([...users, newUser])
    if (Node.isCallExpression(parent)) {
        const expr = parent.getExpression();
        if (Node.isIdentifier(expr) && expr.getText().startsWith('set')) {
            return true;
        }
    }

    // 2. Spread in setter: setUsers([...MOCK_USERS])
    if (Node.isSpreadElement(parent) || Node.isSpreadAssignment(parent)) {
        const grand = parent.getParent();
        if (Node.isCallExpression(grand) && grand.getExpression().getText().startsWith('set')) {
            return true;
        }
    }

    return false;
}

export function generateSignature(id: Identifier): string {
  const parent = id.getParent();
  const lineage = id.getAncestors().slice(0, 4).map(a => a.getKindName()).join('>');
  const siblingKinds = parent?.getChildren().map(c => c.getKindName()).join('|') || '';
  
  // This string represents the logical "neighborhood" of the mock
  return `${lineage}[${siblingKinds}]`;
}

export function extractTransformationExpression(id: Identifier): string {
    let current: Node | undefined = id.getParent();
    let lastTransformationNode: Node | undefined;

    while (current) {
        if (Node.isPropertyAccessExpression(current) || Node.isCallExpression(current)) {
            lastTransformationNode = current;
            current = current.getParent();
        } else {
            break;
        }
    }

    if (lastTransformationNode) {
        const fullText = lastTransformationNode.getText();
        const idText = id.getText();
        // Remove the identifier itself from the start (e.g., "MOCK_USERS.filter(...)" -> ".filter(...)")
        if (fullText.startsWith(idText)) {
            return fullText.slice(idText.length);
        }
        return fullText;
    }

    return "";
}

export function extractTransformations(id: Identifier): string[] {
  const transforms: string[] = [];
  let current = id.getParent();
  
  // Follow property accesses and calls
  while (current) {
    if (Node.isPropertyAccessExpression(current)) {
      transforms.push(current.getName());
    } else if (Node.isCallExpression(current)) {
        // Keep going up
    } else {
        break;
    }
    current = current.getParent();
  }
  
  return Array.from(new Set(transforms));
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
