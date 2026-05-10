import { RenameIntent } from '../orchestrator/migrationOrchestrator.js';

/**
 * SchemaDiffer compares two OpenAPI schemas to detect structural changes.
 */
export class SchemaDiffer {
  /**
   * Detects field renames between old and new schema.
   * Heuristic: Same path, same method, same property type, different property name.
   */
  detectRenames(oldSchema: any, newSchema: any): RenameIntent[] {
    const intents: RenameIntent[] = [];

    for (const path in oldSchema.paths) {
      if (!newSchema.paths[path]) continue;

      for (const method in oldSchema.paths[path]) {
        if (!newSchema.paths[path][method]) continue;

        const oldOp = oldSchema.paths[path][method];
        const newOp = newSchema.paths[path][method];

        const oldProps = this.extractProperties(oldSchema, oldOp);
        const newProps = this.extractProperties(newSchema, newOp);

        // Find potential renames
        for (const oldKey in oldProps) {
          if (newProps[oldKey]) continue; // Key still exists, no rename

          // Look for a new key with the same type
          for (const newKey in newProps) {
            if (oldProps[newKey]) continue; // New key was already there

            if (oldProps[oldKey].type === newProps[newKey].type) {
              const confidence = oldKey.toLowerCase().includes(newKey.toLowerCase()) || newKey.toLowerCase().includes(oldKey.toLowerCase()) ? 0.8 : 0.4;
              intents.push({
                hookName: this.deriveHookName(oldOp, path, method),
                oldFieldName: oldKey,
                newFieldName: newKey,
                confidence,
                reason: confidence > 0.5 ? 'Strong name similarity' : 'Type match only (risky)'
              });
            }
          }
        }
      }
    }

    return intents;
  }

  private extractProperties(schema: any, operation: any): Record<string, any> {
    const response = operation.responses?.['200'] || operation.responses?.['201'];
    if (!response) return {};

    let content = response.content?.['application/json']?.schema;
    if (!content) return {};

    content = this.resolveSchema(schema, content);
    
    if (content.type === 'array' && content.items) {
      content = this.resolveSchema(schema, content.items);
    }

    const properties = content.properties || {};
    // Recursively resolve all properties
    const resolvedProps: Record<string, any> = {};
    for (const key in properties) {
        resolvedProps[key] = this.resolveSchema(schema, properties[key]);
    }

    return resolvedProps;
  }

  /**
   * Recursively resolves $ref nodes within a schema.
   */
  private resolveSchema(schema: any, node: any): any {
    if (!node || typeof node !== 'object') return node;
    
    if (node.$ref) {
      const resolved = this.resolveRef(schema, node.$ref);
      return this.resolveSchema(schema, resolved);
    }
    
    return node;
  }

  private resolveRef(schema: any, ref: string): any {
    const path = ref.replace('#/', '').split('/');
    let current = schema;
    for (const segment of path) {
      if (!current[segment]) return {};
      current = current[segment];
    }
    return current;
  }

  private deriveHookName(op: any, path: string, method: string): string {
    if (op.operationId) {
      return `use${op.operationId.charAt(0).toUpperCase() + op.operationId.slice(1)}`;
    }
    return `use${method.toUpperCase()}${path.replace(/\//g, '')}`;
  }
}
