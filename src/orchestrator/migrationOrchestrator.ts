import { Project, SyntaxKind, Identifier, PropertyAccessExpression, SourceFile } from 'ts-morph';
import { logger } from '../utils/logger.js';
import { GlobalStateTracer } from '../analysis/globalStateTracer.js';
import pc from 'picocolors';

export interface RenameIntent {
  hookName: string;
  oldFieldName: string;
  newFieldName: string;
}

/**
 * MigrationOrchestrator is the engine for project-wide semantic refactoring.
 * It uses AST surgery to ensure that a change in the backend contract 
 * is reflected safely across the entire frontend.
 */
export class MigrationOrchestrator {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  /**
   * Performs a project-wide rename of a field derived from a specific hook.
   */
  async applyRename(intent: RenameIntent): Promise<{ affectedFiles: string[] }> {
    logger.startSpinner(`Orchestrating migration: ${pc.cyan(intent.oldFieldName)} → ${pc.green(intent.newFieldName)}...`);
    
    const affectedFiles = new Set<string>();

    // 1. Find all usages of the hook
    for (const sourceFile of this.project.getSourceFiles()) {
      const usages = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
        .filter(id => id.getText() === intent.hookName);

      for (const usage of usages) {
        // Find where the result of the hook is consumed
        // e.g. const { data } = useUsers();
        const parent = usage.getParent();
        if (parent?.getKind() === SyntaxKind.CallExpression) {
          this.traceAndRename(usage, intent, affectedFiles);
        }
      }
      
      // 2. Also check Zod schemas in the same file
      this.updateZodSchema(sourceFile, intent, affectedFiles);
    }

    // 3. Post-Surgery Audit: verify project still compiles
    const diagnostics = this.project.getPreEmitDiagnostics();
    if (diagnostics.length > 0) {
      logger.stopSpinner(false, `Migration completed with ${diagnostics.length} type errors.`);
      logger.warn('Surgery was successful but revealed downstream type conflicts. Manual review required.');
    } else {
      logger.stopSpinner(true, `Migration successful! ${affectedFiles.size} files refactored.`);
    }

    return { affectedFiles: Array.from(affectedFiles) };
  }

  /**
   * Traces the variable holding the API response and renames the target field.
   */
  private traceAndRename(hookUsage: Identifier, intent: RenameIntent, affectedFiles: Set<string>) {
    const varDec = hookUsage.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (!varDec) return;

    const nameNode = varDec.getNameNode();
    
    // Case 1: Destructuring - const { data } = useUsers();
    if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
      const bindingPattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
      const dataBinding = bindingPattern.getElements().find(el => el.getName() === 'data');
      if (dataBinding) {
        const dataVar = dataBinding.getNameNode();
        this.renameUsages(dataVar as Identifier, intent.oldFieldName, intent.newFieldName, affectedFiles);
      }
    }
    
    // Case 2: Direct assignment - const users = useUsers();
    if (nameNode.getKind() === SyntaxKind.Identifier) {
      this.renameUsages(nameNode as Identifier, intent.oldFieldName, intent.newFieldName, affectedFiles);
    }
  }

  /**
   * Finds all property accesses (e.g. data.oldField) and renames them.
   */
  private renameUsages(identifier: Identifier, oldField: string, newField: string, affectedFiles: Set<string>) {
    const references = identifier.findReferencesAsNodes();
    
    for (const ref of references) {
      const parent = ref.getParent();
      
      // Handle data.oldField
      if (parent?.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = parent.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        if (propAccess.getName() === oldField) {
          propAccess.getNameNode().replaceWithText(newField);
          affectedFiles.add(ref.getSourceFile().getFilePath());
        }
      }
      
      // Handle const { oldField } = data
      if (parent?.getKind() === SyntaxKind.BindingElement) {
        const bindingEl = parent.asKindOrThrow(SyntaxKind.BindingElement);
        if (bindingEl.getName() === oldField) {
          bindingEl.rename(newField);
          affectedFiles.add(ref.getSourceFile().getFilePath());
        }
      }
    }
  }

  /**
   * Updates Zod schemas that might define the shape of this API response.
   */
  private updateZodSchema(sourceFile: SourceFile, intent: RenameIntent, affectedFiles: Set<string>) {
    const zodProps = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .filter(prop => {
        const name = prop.getName();
        return name === intent.oldFieldName;
      });

    for (const prop of zodProps) {
      // Check if it's inside a z.object({})
      const zObject = prop.getFirstAncestor(node => node.getText().includes('z.object'));
      if (zObject) {
        prop.getNameNode().replaceWithText(intent.newFieldName);
        affectedFiles.add(sourceFile.getFilePath());
      }
    }
  }
}
