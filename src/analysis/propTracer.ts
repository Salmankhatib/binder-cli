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
  project: Project,
  depth: number = 0,
  maxDepth: number = 5,
  visited: Set<string> = new Set()
): Promise<PropDrillResult[]> {
  const results: PropDrillResult[] = [];
  if (depth >= maxDepth) return results;

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
    let targetSourceFile = null;
    try {
        const definitions = (openingEl as any).getTagNameNode().getDefinitions();
        if (definitions && definitions.length > 0) {
            targetFile = definitions[0].getSourceFile().getFilePath();
            targetSourceFile = project.getSourceFile(targetFile);
        }
    } catch (e) {
        // Fallback for isolated files
    }

    const drillId = `${sourceFile.getFilePath()}->${targetFile}:${propName}`;
    if (visited.has(drillId)) continue;
    visited.add(drillId);

    results.push({
        sourceFile: sourceFile.getFilePath(),
        targetFile: targetFile,
        propName,
        componentName
    });

    // Recursively trace the prop inside the target file
    if (targetSourceFile && targetFile !== 'unknown') {
        // Find the prop usage in the target component
        const nextDrills = await tracePropDrilling(propName, targetSourceFile, project, depth + 1, maxDepth, visited);
        results.push(...nextDrills);
    }
  }
  
  return results;
}
