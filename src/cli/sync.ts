import { logger } from '../utils/logger.js';
import { loadConfig } from '../config/loader.js';
import { runOrval } from '../generate/orvalRunner.js';
import { scanMocks } from '../scan/mockScanner.js';
import { resolve } from 'path';
import pc from 'picocolors';
import { MigrationOrchestrator } from '../orchestrator/migrationOrchestrator.js';
import { SchemaDiffer } from '../analysis/schemaDiffer.js';
import { Project } from 'ts-morph';
import { readdirSync } from 'fs';

/**
 * binder sync pulls the latest schema and scans for new mocks.
 * If --apply is provided, it attempts to refactor drifts automatically.
 */
export async function runSync(options: { apply?: boolean } = {}) {
  const config = await loadConfig('./binder.config.json');
  
  logger.startSpinner('🔄 Syncing API Infrastructure...');
  try {
    await runOrval(config.backend.schemaPath, config.frontend.generatedDir, config.orval);
    logger.stopSpinner(true, 'API Infrastructure Synchronized.');
  } catch (e) {
    logger.stopSpinner(false, 'Failed to synchronize API infrastructure.');
    return;
  }

  if (options.apply) {
    logger.system('Applying Sovereign Intelligence Migration...');
    
    // 1. Get the previous schema from the latest snapshot
    const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
    const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort();
    
    if (files.length > 0) {
      const lastSnapshot = JSON.parse(readFileSync(join(snapshotsDir, files[files.length - 1]), 'utf-8'));
      const oldSchema = lastSnapshot.backend?.schema; // Assuming schema is stored in snapshot

      if (oldSchema) {
        const newSchema = JSON.parse(readFileSync(resolve(process.cwd(), config.backend.schemaPath), 'utf-8'));
        const differ = new SchemaDiffer();
        const renames = differ.detectRenames(oldSchema, newSchema);

        if (renames.length > 0) {
          logger.info(`Detected ${renames.length} field renames. Starting project-wide refactor...`);
          const project = new Project();
          project.addSourceFilesAtPaths('src/**/*.ts*');
          const orchestrator = new MigrationOrchestrator(project);

          for (const intent of renames) {
            await orchestrator.applyRename(intent);
          }

          await project.save();
          logger.success('Autonomous Migration Complete.');
        } else {
          logger.info('No renames detected to apply.');
        }
      }
    }
  }

  console.log(pc.green('\n✨ Project is in sync with the latest schema.'));
}
