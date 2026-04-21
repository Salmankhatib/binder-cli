import { Project, SyntaxKind, Node, SourceFile } from "ts-morph";
import { logger } from "../utils/logger.js";

export interface SurgicalOrder {
  type: 'WRAP_DATA' | 'RENAME_FIELD' | 'USE_PENDING' | 'TRANSFORM_SPREAD' | 'BIND_MUTATION';
  target?: string;
  payload?: any;
}

export function applySurgicalOrders(sourceCode: string, orders: SurgicalOrder[]): string {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 4 } });
  const sourceFile = project.createSourceFile("temp.tsx", sourceCode);

  for (const order of orders) {
    const type = order.type || (order as any).orderType;
    logger.system(`  [Surgery] Executing Order: ${type} on ${order.target || 'component'}`);
    try {
      switch (type) {
        case 'WRAP_DATA':
          wrapHookData(sourceFile, order.target!);
          break;
        case 'RENAME_FIELD':
          // Smarter rename: Find the variable returned by hook, then rename its property usages
          const oldName = order.payload.old;
          const newName = order.payload.new;
          const hookTarget = order.target;
          
          if (hookTarget) {
              const hookVar = findDataVariableForHook(sourceFile, hookTarget);
              if (hookVar) {
                  renamePropertyUsage(sourceFile, hookVar, oldName, newName);
              }
          } else {
              // Fallback to global rename (less safe)
              renameIdentifierGlobal(sourceFile, oldName, newName);
          }
          break;
        case 'BIND_MUTATION':
          bindMutation(sourceFile, order.target!, order.payload.hookName, order.payload.params);
          break;
      }
    } catch (e) {
      logger.error(`  [Surgery] Error: ${(e as Error).message}`);
    }
  }

  return sourceFile.getFullText();
}

function findDataVariableForHook(sourceFile: SourceFile, hookName: string): string | null {
    let foundVar: string | null = null;
    sourceFile.forEachDescendant(node => {
        if (Node.isVariableDeclaration(node)) {
            const init = node.getInitializer();
            if (init && Node.isCallExpression(init) && init.getExpression().getText().includes(hookName)) {
                const nameNode = node.getNameNode();
                if (Node.isObjectBindingPattern(nameNode)) {
                    const dataElem = nameNode.getElements().find(e => e.getName() === 'data' || e.getPropertyName() === 'data');
                    if (dataElem) foundVar = dataElem.getName();
                }
            }
        }
    });
    return foundVar;
}

function renamePropertyUsage(sourceFile: SourceFile, varName: string, oldProp: string, newProp: string) {
    sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).forEach(prop => {
        if (prop.getExpression().getText() === varName && prop.getName() === oldProp) {
            prop.getNameNode().replaceWithText(newProp);
        }
    });
    // Also catch in map(item => item.prop)
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach(id => {
        if (id.getText() === oldProp) {
            const parent = id.getParent();
            if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) {
                 // Check if the base expression is a parameter of a map/forEach that came from varName
                 id.replaceWithText(newProp);
            }
        }
    });
}

function renameIdentifierGlobal(sourceFile: SourceFile, old: string, n: string) {
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach(id => {
        if (id.getText() === old && !Node.isPropertyAssignment(id.getParent())) {
            id.replaceWithText(n);
        }
    });
}

function bindMutation(sourceFile: SourceFile, mockFuncName: string, hookName: string, params?: string[]) {
    sourceFile.forEachDescendant(node => {
        if (Node.isFunctionDeclaration(node) || Node.isVariableDeclaration(node)) {
            const name = Node.isFunctionDeclaration(node) ? node.getName() : node.getName();
            if (name === mockFuncName) {
                const componentBody = node.getFirstAncestorByKind(SyntaxKind.Block);
                if (componentBody) {
                    const hookVar = `${mockFuncName}Mutation`;
                    if (!componentBody.getText().includes(hookName)) {
                        componentBody.insertStatements(0, `const ${hookVar} = ${hookName}();`);
                    }
                    const body = `${hookVar}.mutate({ ${params?.join(', ') || ''} });`;
                    if (Node.isFunctionDeclaration(node)) node.setBodyText(body);
                    else {
                        const init = node.getInitializer();
                        if (init && Node.isArrowFunction(init)) init.setBodyText(body);
                    }
                }
            }
        }
    });
}

function wrapHookData(sourceFile: SourceFile, hookName: string) {
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
    if (call.getExpression().getText().includes(hookName)) {
      const varDec = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      if (varDec) {
        const nameNode = varDec.getNameNode();
        if (Node.isObjectBindingPattern(nameNode)) {
          const dataElem = nameNode.getElements().find(e => e.getName() === 'data' || e.getPropertyName() === 'data');
          if (dataElem) {
            const originalName = dataElem.getName();
            dataElem.replaceWithText(`data: ${originalName}Raw`);
            const statement = varDec.getFirstAncestorByKind(SyntaxKind.VariableStatement);
            statement?.insertAfterSelf(`const ${originalName} = ${originalName}Raw?.data;`);
          }
        }
      }
    }
  });
}