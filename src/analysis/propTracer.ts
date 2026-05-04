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
    
    const propName = (jsxAttr as any).getNameNode?.().getText() || (jsxAttr as any).getName?.() || 'unknown';
    const openingEl = (jsxAttr as any).getFirstAncestorByKind(SyntaxKind.JsxOpeningElement) || 
                      (jsxAttr as any).getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement);
    
    if (!openingEl) continue;
    
    const componentName = (openingEl as any).getTagNameNode().getText();
    
    // Find component definition across project
    let targetFile = 'unknown';
    try {
        const definitions = (openingEl as any).getTagNameNode().getDefinitions();
        if (definitions && definitions.length > 0) {
            targetFile = definitions[0].getSourceFile().getFilePath();
        }
    } catch (e) {
        // Fallback for isolated files
    }

    results.push({
        sourceFile: sourceFile.getFilePath(),
        targetFile: targetFile,
        propName,
        componentName
    });
  }
  
  return results;
}
