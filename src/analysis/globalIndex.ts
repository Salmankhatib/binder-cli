import { Project, SyntaxKind } from 'ts-morph';

export interface RepositoryImpactMap {
  hookUsageFrequency: Record<string, number>;
  totalFilesAnalyzed: number;
}

/**
 * Builds a project-wide index of hook usage to provide global context for decisions.
 */
export async function buildRepositoryImpactMap(project: Project): Promise<RepositoryImpactMap> {
  const impactMap: Record<string, number> = {};
  const sourceFiles = project.getSourceFiles();

  for (const file of sourceFiles) {
    // Only analyze source files, skip generated or node_modules if present
    if (file.getFilePath().includes('node_modules') || file.getFilePath().includes('generated')) {
        continue;
    }

    // Find all call expressions to functions starting with 'use'
    file.getDescendantsOfKind(SyntaxKind.Identifier)
      .filter(id => id.getText().startsWith('use'))
      .forEach(id => {
        const name = id.getText();
        impactMap[name] = (impactMap[name] || 0) + 1;
      });
  }

  return {
    hookUsageFrequency: impactMap,
    totalFilesAnalyzed: sourceFiles.length
  };
}
