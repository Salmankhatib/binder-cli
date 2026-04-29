// src/rewrite/effectRewriter.ts
import { Node, CallExpression, ArrayLiteralExpression } from 'ts-morph';

export interface EffectRewriteResult {
    replaceDeps: string[];
    replaceBody: string;
}

export function rewriteEffectDependency(
  effect: CallExpression,
  mockName: string,
  hookVar: string
): EffectRewriteResult | null {
  const args = effect.getArguments();
  if (args.length < 2) return null;

  const depsArray = args[1];
  if (!Node.isArrayLiteralExpression(depsArray)) return null;
  
  // Replace mock in dependency array
  const newDeps = depsArray.getElements().map(el => {
    if (el.getText() === mockName) {
      return hookVar; 
    }
    return el.getText();
  });
  
  // Add isLoading guard inside effect body
  const body = args[0];
  const bodyText = body.getText();
  
  // Check if it's an arrow function with a block or expression
  let guardedBody = "";
  if (Node.isArrowFunction(body) || Node.isFunctionExpression(body)) {
      const funcBody = body.getBody();
      if (Node.isBlock(funcBody)) {
          guardedBody = `
  if (!${hookVar}) return;
  ${funcBody.getStatements().map(s => s.getText()).join('\n  ')}
          `.trim();
      } else {
          guardedBody = `if (${hookVar}) { ${funcBody.getText()} }`;
      }
  }
  
  return {
    replaceDeps: newDeps,
    replaceBody: guardedBody
  };
}
