// src/analysis/propTracer.ts
import { Project, SyntaxKind, Node, Identifier } from 'ts-morph';

export interface PropDrillResult {
  sourceFile: string;
  targetFile: string;
  propName: string;
  componentName: string;
}

export async function tracePropDrilling(
  mockName: string,
  sourceFile: any,
  project: Project
): Promise<PropDrillResult[]> {
  const results: PropDrillResult[] = [];
  
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id: Identifier) => id.getText() === mockName);

  for (const id of identifiers) {
    const jsxAttr = id.getFirstAncestorByKind(SyntaxKind.JsxAttribute);
    if (!jsxAttr) continue;
    
    const propName = jsxAttr.getName();
    const openingEl = jsxAttr.getFirstAncestorByKind(SyntaxKind.JsxOpeningElement) || 
                      jsxAttr.getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement);
    
    if (!openingEl) continue;
    
    const componentName = openingEl.getTagNameNode().getText();
    
    // Find component definition across project
    const definitions = (openingEl.getTagNameNode() as any).getDefinitions();
    if (definitions && definitions.length > 0) {
        const def = definitions[0];
        results.push({
            sourceFile: sourceFile.getFilePath(),
            targetFile: def.getSourceFile().getFilePath(),
            propName,
            componentName
        });
    }
  }
  
  return results;
}
