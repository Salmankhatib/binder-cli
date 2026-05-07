import chokidar from 'chokidar';
import { resolve } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import { runDrift } from './drift.js';
import { loadConfig } from '../config/loader.js';

/**
 * binder watch provides real-time feedback for local developers.
 * It watches the schema and source files for changes.
 */
export async function runWatch() {
  const config = await loadConfig('./binder.config.json');
  const schemaPath = resolve(process.cwd(), config.backend.schemaPath || 'openapi.json');
  const srcPath = resolve(process.cwd(), 'src');

  console.clear();
  console.log(pc.bold(pc.cyan('👁️  BINDER WATCH SENTINEL ACTIVE')));
  console.log(pc.gray(`Watching schema: ${schemaPath}`));
  console.log(pc.gray(`Watching source: ${srcPath}`));
  console.log(pc.gray('----------------------------------------\n'));

  const watcher = chokidar.watch([schemaPath, srcPath], {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('change', async (path) => {
    console.log(pc.yellow(`\n🔔 Change detected: ${pc.bold(path)}`));
    
    if (path.endsWith('.json')) {
      logger.info('Schema updated! Re-validating contracts...');
      await runDrift();
    } else {
      logger.info('Source updated! Checking for drift...');
      // In a real dev flow, we might only check the changed file
      await runDrift();
    }
    
    console.log(pc.gray('\nWaiting for changes...'));
  });

  watcher.on('error', error => logger.error(`Watcher error: ${error}`));
}
