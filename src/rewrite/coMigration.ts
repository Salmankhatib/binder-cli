// src/rewrite/coMigration.ts
import { Project, SourceFile } from 'ts-morph';
import { logger } from '../utils/logger.js';
import type { Binding } from '../common/types.js';

export interface CoMigration {
  file: string;
  success: boolean;
}

export async function coMigrate(
  binding: Binding,
  project: Project
): Promise<CoMigration[]> {
  const results: CoMigration[] = [];
  
  // Find test files
  const tests = project.getSourceFiles()
    .filter(f => f.getFilePath().match(/\.(test|spec)\./));
    
  for (const test of tests) {
    if (test.getText().includes(binding.mockName)) {
        logger.system(`  [Co-Migration] Updating test file: ${test.getBaseName()}`);
        // Simple swap for now
        test.replaceWithText(test.getText().replace(new RegExp(binding.mockName, 'g'), `${binding.hookName}Data`));
        results.push({ file: test.getFilePath(), success: true });
    }
  }
  
  return results;
}
