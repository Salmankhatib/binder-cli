import { Project, SyntaxKind, Identifier, PropertyAccessExpression, SourceFile } from 'ts-morph';
import { logger } from '../utils/logger.js';
import { GlobalStateTracer } from '../analysis/globalStateTracer.js';
import pc from 'picocolors';

export interface RenameIntent {
  hookName: string;
  oldFieldName: string;
  newFieldName: string;
  confidence: number;
  reason: string;
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
  async applyRename(intent: RenameIntent): Promise<{ affectedFiles: string[]; success: boolean }> {
    logger.startSpinner(`Orchestrating migration: ${pc.cyan(intent.oldFieldName)} → ${pc.green(intent.newFieldName)}...`);
    
    const affectedFiles = new Set<string>();

    // 1. Find all usages of the hook
    for (const sourceFile of this.project.getSourceFiles()) {
      const usages = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
        .filter(id => id.getText() === intent.hookName);

      for (const usage of usages) {
        const parent = usage.getParent();
        if (parent?.getKind() === SyntaxKind.CallExpression) {
          this.traceAndRename(usage, intent, affectedFiles);
        }
      }
      
      this.updateZodSchema(sourceFile, intent, affectedFiles);
    }

    // 2. Post-Surgery Audit: verify project still compiles
    logger.startSpinner('Running Transactional Safety Check (Pre-flight)...');
    const diagnostics = this.project.getPreEmitDiagnostics();
    
    if (diagnostics.length > 0) {
      const errorCount = diagnostics.length;
      logger.stopSpinner(false, `Migration completed but introduced ${pc.red(errorCount)} type errors.`);
      logger.warn('Surgery revealed downstream type conflicts. Suggesting immediate rollback or manual review.');
      return { affectedFiles: Array.from(affectedFiles), success: false };
    } else {
      logger.stopSpinner(true, `Migration successful! ${affectedFiles.size} files refactored with zero errors.`);
      return { affectedFiles: Array.from(affectedFiles), success: true };
    }
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
  /**
   * High-Level Surgery: Replaces a hardcoded mock variable with a live API hook.
   */
  async bindMockToApi(mockName: string, filePath: string, endpoint: string): Promise<boolean> {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return false;

    const varDec = sourceFile.getVariableDeclaration(mockName);
    if (!varDec) return false;

    // 1. Determine the hook name (e.g. /api/users -> useGetUsers)
    const hookName = `useGet${endpoint.split('/').pop()?.charAt(0).toUpperCase()}${endpoint.split('/').pop()?.slice(1)}`;

    // 2. Perform the replacement
    // Before: const users = [{...}];
    // After: const { data: users } = useGetUsers();
    
    const parent = varDec.getParent(); // VariableDeclarationList
    const statement = parent?.getParent(); // VariableStatement

    if (statement && Node.isVariableStatement(statement)) {
        statement.replaceWithText(`const { data: ${mockName} } = ${hookName}();`);
    }

    // 3. Add import if missing (Heuristic: assumes hooks are available)
    if (!sourceFile.getImportDeclaration(d => d.getText().includes(hookName))) {
        sourceFile.addImportDeclaration({
            moduleSpecifier: '@/hooks/api', // Standard path
            namedImports: [hookName]
        });
    }

    await this.project.save();
    return true;
  }
}
