import { logger } from '../utils/logger.js';
import { loadConfig } from '../config/loader.js';
import { runOrval } from '../generate/orvalRunner.js';
import { resolve, join } from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';
import pc from 'picocolors';
import pkg from 'enquirer';
const { Select } = pkg;
import { MigrationOrchestrator, RenameIntent } from '../orchestrator/migrationOrchestrator.js';
import { SchemaDiffer } from '../analysis/schemaDiffer.js';
import { ProjectManager } from '../engine/projectManager.js';
import { BinderMCP } from '../mcp/client.js';
import { SurgeryOrchestrator } from '../orchestrator/surgeryOrchestrator.js';

/**
 * binder sync pulls the latest schema and scans for structural drift.
 * It presents a migration plan for human review before applying AST surgery.
 */
export async function runSync(options: { apply?: boolean } = {}) {
  const config = await loadConfig('./binder.config.json');
  const mcp = new BinderMCP();
  await mcp.initialize(config);
  
  const orchestrator = new SurgeryOrchestrator(config, mcp);
  
  logger.startSpinner('🔄 Syncing API Infrastructure...');
  try {
    await runOrval(config.backend.schemaPath, config.frontend.generatedDir, config.orval);
    logger.stopSpinner(true, 'API Infrastructure Synchronized.');
  } catch (e) {
    logger.stopSpinner(false, 'Failed to synchronize API infrastructure.');
    return;
  }

  // 1. Get the previous schema from the latest snapshot
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
  if (!existsSync(snapshotsDir) || !readdirSync(snapshotsDir).length) {
    logger.info('No snapshots found. Run `binder snapshot` first to enable drift detection.');
    return;
  }

  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort();
  const lastSnapshot = JSON.parse(readFileSync(join(snapshotsDir, files[files.length - 1]), 'utf-8'));
  const oldSchema = lastSnapshot.backend?.schema; 

  if (oldSchema) {
    const newSchema = JSON.parse(readFileSync(resolve(process.cwd(), config.backend.schemaPath), 'utf-8'));
    const differ = new SchemaDiffer();
    const renames = differ.detectRenames(oldSchema, newSchema);

    if (renames.length > 0) {
      logger.info(`Detected ${renames.length} potential field renames (drifts).`);
      
      const projectManager = ProjectManager.getInstance();
      const project = projectManager.getProject();
      project.addSourceFilesAtPaths('src/**/*.ts*');
      
      const orchestrator = new MigrationOrchestrator(project);
      const approvedRenames: RenameIntent[] = [];

      for (const intent of renames) {
        console.log(`\n${pc.bold(pc.yellow('Proposed Migration:'))}`);
        console.log(`  Target Hook: ${pc.cyan(intent.hookName)}`);
        console.log(`  Field Drift: ${pc.red(intent.oldFieldName)} → ${pc.green(intent.newFieldName)}`);
        console.log(`  Confidence:  ${(intent.confidence * 100).toFixed(0)}% (${intent.reason})`);

        const action = await new Select({
          message: 'What would you like to do?',
          choices: [
            { name: 'apply', message: 'Apply this refactor' },
            { name: 'edit', message: 'Edit rename intent' },
            { name: 'skip', message: 'Skip this one' }
          ]
        }).run();

        if (action === 'apply') {
          approvedRenames.push(intent);
        } else if (action === 'edit') {
          const { newName } = await (pkg as any).prompt({
            type: 'input',
            name: 'newName',
            message: `Enter correct field name for ${pc.cyan(intent.oldFieldName)}:`,
            initial: intent.newFieldName
          });
          intent.newFieldName = newName;
          approvedRenames.push(intent);
        }
      }

      if (approvedRenames.length > 0) {
        logger.startSpinner(`Orchestrating ${approvedRenames.length} approved migrations...`);
        const migrationOrch = new MigrationOrchestrator(project);
        for (const intent of approvedRenames) {
          await migrationOrch.applyRename(intent);
        }

        // Post-migration safety check & formatting via Surgical Orchestrator
        const affectedFiles = project.getSourceFiles().filter(sf => sf.getUnsavedChanges() !== undefined);
        for (const sf of affectedFiles) {
            const result = await orchestrator.operate(sf.getFilePath(), sf.getFullText());
            if (result.success) {
                sf.replaceWithText(result.finalCode);
            } else {
                logger.error(`  [Sync] Failed to heal ${pc.bold(sf.getFilePath())}. Reverting to original state.`);
                sf.refreshFromFileSystemSync();
            }
        }

        await project.save();
        logger.stopSpinner(true, 'Sovereign Migration Complete.');
      } else {
        logger.info('No migrations were approved.');
      }
    } else {
      logger.info('No structural drifts detected.');
    }
  }

  console.log(pc.green('\n✨ Project is in sync with the latest schema.'));
}
