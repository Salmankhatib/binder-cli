import { Node, SyntaxKind, Type, Symbol, Identifier, SourceFile } from 'ts-morph';
import { logger } from '../utils/logger.js';

export interface InferredInput {
  expression: string;
  confidence: number;
  source: 'prop' | 'state' | 'params' | 'context' | 'variable';
}

/**
 * Input Inference Engine for tRPC and REST.
 * Analyzes the local scope of a component to find variables that match an API procedure's input schema.
 */
export class InputInferenceEngine {
  /**
   * Attempts to resolve an input expression for a given procedure.
   */
  async inferInput(
    usageNode: Node,
    inputSchemaText: string | null,
    sourceFile: SourceFile
  ): Promise<InferredInput | null> {
    if (!inputSchemaText || inputSchemaText === 'void' || inputSchemaText === 'undefined') {
      return null;
    }

    const component = this.findEnclosingComponent(usageNode);
    if (!component) return null;

    const candidates: InferredInput[] = [];

    // 1. Analyze Props
    const propCandidates = this.analyzeProps(component, inputSchemaText);
    candidates.push(...propCandidates);

    // 2. Analyze Local State
    const stateCandidates = this.analyzeState(component, inputSchemaText);
    candidates.push(...stateCandidates);

    // 3. Analyze Hooks (useParams, useAuth etc)
    const hookCandidates = this.analyzeHookOutputs(component, inputSchemaText);
    candidates.push(...hookCandidates);

    if (candidates.length === 0) return null;

    // Rank by confidence
    return candidates.sort((a, b) => b.confidence - a.confidence)[0];
  }

  private findEnclosingComponent(node: Node): Node | null {
    return node.getFirstAncestor(a => 
      Node.isFunctionDeclaration(a) || 
      Node.isArrowFunction(a) || 
      Node.isFunctionExpression(a)
    ) || null;
  }

  private analyzeProps(component: Node, schemaText: string): InferredInput[] {
    const results: InferredInput[] = [];
    const params = (component as any).getParameters?.() || [];
    
    if (params.length > 0) {
      const firstParam = params[0];
      const nameNode = firstParam.getNameNode();

      if (Node.isObjectBindingPattern(nameNode)) {
        // function Component({ userId, orgId })
        for (const element of nameNode.getElements()) {
          const name = element.getName();
          if (this.isTypeMatch(name, schemaText)) {
            results.push({ expression: name, confidence: 0.9, source: 'prop' });
          }
        }
      } else if (Node.isIdentifier(nameNode)) {
        // function Component(props)
        const name = nameNode.getText();
        if (this.isTypeMatch(name, schemaText)) {
            results.push({ expression: name, confidence: 0.8, source: 'prop' });
        }
      }
    }
    return results;
  }

  private analyzeState(component: Node, schemaText: string): InferredInput[] {
    const results: InferredInput[] = [];
    const body = (component as any).getBody?.();
    if (!body) return results;

    // Look for useState calls
    const useStateCalls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c: any) => c.getExpression().getText() === 'useState');

    for (const call of useStateCalls) {
      const parent = call.getParent();
      if (Node.isVariableDeclaration(parent)) {
        const nameNode = parent.getNameNode();
        if (Node.isArrayBindingPattern(nameNode)) {
          const stateVar = nameNode.getElements()[0]?.getText();
          if (stateVar && this.isTypeMatch(stateVar, schemaText)) {
            results.push({ expression: stateVar, confidence: 0.85, source: 'state' });
          }
        }
      }
    }
    return results;
  }

  private analyzeHookOutputs(component: Node, schemaText: string): InferredInput[] {
    const results: InferredInput[] = [];
    const body = (component as any).getBody?.();
    if (!body) return results;

    const hookCalls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c: any) => c.getExpression().getText().startsWith('use') && c.getExpression().getText() !== 'useState');

    for (const call of hookCalls) {
      const hookName = (call as any).getExpression().getText();
      const parent = call.getParent();
      
      if (Node.isVariableDeclaration(parent)) {
        const varName = parent.getName();
        
        // Handle useParams() -> { id }
        if (hookName === 'useParams') {
            if (schemaText.includes('id') || schemaText.includes('string')) {
                results.push({ expression: `${varName}.id`, confidence: 0.8, source: 'params' });
            }
        }

        // General variable match
        if (this.isTypeMatch(varName, schemaText)) {
          results.push({ expression: varName, confidence: 0.7, source: 'context' });
        }
      }
    }
    return results;
  }

  private isTypeMatch(varName: string, schemaText: string): boolean {
    const v = varName.toLowerCase();
    const s = schemaText.toLowerCase();
    
    // Heuristic: if variable name is in schema or vice versa
    if (v.includes(s) || s.includes(v)) return true;

    // Special case for common ID patterns
    if ((v === 'id' || v.endsWith('id')) && (s.includes('string') || s.includes('number'))) return true;

    return false;
  }
}
