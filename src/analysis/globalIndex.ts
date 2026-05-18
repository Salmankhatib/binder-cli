import { Project, SyntaxKind } from 'ts-morph';
import { BinderIndex } from './persistence/db.js';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

export interface RepositoryImpactMap {
  hookUsageFrequency: Record<string, number>;
  totalFilesAnalyzed: number;
}

/**
 * Builds or updates a project-wide index of hook usage.
 * Uses a persistent cache and only re-scans changed files (Delta Updates).
 */
export async function buildRepositoryImpactMap(project: Project): Promise<RepositoryImpactMap> {
  const index = BinderIndex.getInstance();
  const sourceFiles = project.getSourceFiles();
  let updatedCount = 0;

  for (const file of sourceFiles) {
    const filePath = file.getFilePath();
    
    // Skip external or generated files
    if (filePath.includes('node_modules') || filePath.includes('generated')) {
        continue;
    }

    if (!existsSync(filePath)) continue;

    const currentHash = getFileHash(filePath);
    const cached = index.getFileData(filePath);

    if (cached && cached.hash === currentHash) {
        continue; // Cache hit, skip scanning
    }

    // Cache miss or changed: Scan file
    const hooks: string[] = [];
    file.getDescendantsOfKind(SyntaxKind.Identifier)
      .filter(id => id.getText().startsWith('use'))
      .forEach(id => {
        hooks.push(id.getText());
      });
    
    // We could also extract symbol definitions here if needed in the future
    const symbols: string[] = []; 

    index.setFileData(filePath, currentHash, hooks, symbols);
    updatedCount++;
  }

  if (updatedCount > 0) {
      index.save();
  }

  return {
    hookUsageFrequency: index.getAllHookFrequencies(),
    totalFilesAnalyzed: index.getFilesCount()
  };
}

function getFileHash(filePath: string): string {
  try {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return '0';
  }
}
