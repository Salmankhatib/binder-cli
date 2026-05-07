import { Project, SyntaxKind } from 'ts-morph';
import { resolve, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { scanMocks } from '../scan/mockScanner.js';
import { safeBind } from '../orchestrator/safeBind.js';
import { logger } from '../utils/logger.js';
import pc from 'picocolors';
import type { Config } from '../config/types.js';

export interface PropagationMatch {
  mockName: string;
  hookName: string;
  files: string[];
}

/**
 * Scans the repository for mock names that were successfully bound in the current session
 * and applies the same binding to all other instances.
 */
export async function propagateMatches(
  targets: Array<{ mockName: string, hookName: string }>,
  config: Config,
  projectFiles: string[]
): Promise<number> {
  let appliedCount = 0;
  const uniqueMocks = Array.from(new Set(targets.map(t => t.mockName)));
  
  logger.startSpinner(`Scanning project for ${uniqueMocks.length} mock matches...`);

  for (const mockName of uniqueMocks) {
    const targetHook = targets.find(t => t.mockName === mockName)?.hookName;
    if (!targetHook) continue;

    for (const file of projectFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes(mockName)) {
        // Double check with scanner
        const mocks = scanMocks(file, config);
        if (mocks.some(m => m.name === mockName)) {
          logger.system(`  [Propagate] Found ${pc.yellow(mockName)} in ${pc.bold(file)}. Applying ${pc.green(targetHook)}.`);
          
          // Re-run safeBind for this specific file/mock
          // Note: we pass a restricted mock list to avoid re-processing everything
          const result = await safeBind(
            mocks.filter(m => m.name === mockName), 
            file, 
            config, 
            [targetHook], 
            { dryRun: false, interactive: false }
          );

          if (result.rewrittenCode) {
            writeFileSync(file, result.rewrittenCode);
            appliedCount++;
          }
        }
      }
    }
  }

  logger.stopSpinner(true, `Propagation complete. Applied ${appliedCount} project-wide swaps.`);
  return appliedCount;
}
