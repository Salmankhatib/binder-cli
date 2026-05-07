import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../config/loader.js';

/**
 * binder verify --target <tag> cross-checks the current state against a specific snapshot tag.
 */
export async function runVerify(options: { target: string }) {
  const config = await loadConfig('./binder.config.json');
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
  
  if (!existsSync(snapshotsDir)) {
    logger.error('No snapshots found. Run "binder snapshot" first.');
    return;
  }

  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json'));
  let targetSnapshot: any = null;

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(snapshotsDir, file), 'utf-8'));
    if (data.id === options.target || data.backend?.version === options.target) {
      targetSnapshot = data;
      break;
    }
  }

  if (!targetSnapshot) {
    logger.error(`Snapshot with tag/id "${options.target}" not found.`);
    return;
  }

  logger.startSpinner(`Verifying compatibility with ${pc.bold(options.target)}...`);

  // Simple compatibility check: does our current version match the verified version in that snapshot?
  const currentFrontendVersion = process.env.FRONTEND_VERSION || 'unknown';
  const isCompatible = targetSnapshot.status === 'verified' && (targetSnapshot.frontend?.version === currentFrontendVersion || currentFrontendVersion === 'unknown');

  if (isCompatible) {
    logger.stopSpinner(true, `Verified: Current frontend is compatible with ${options.target}.`);
  } else {
    logger.stopSpinner(false, `Incompatible: Contract drift detected or snapshot status is "${targetSnapshot.status}".`);
    console.log(pc.yellow(`\nSnapshot Status: ${targetSnapshot.status}`));
    console.log(pc.yellow(`Snapshot Frontend Version: ${targetSnapshot.frontend?.version}`));
    console.log(pc.yellow(`Current Frontend Version: ${currentFrontendVersion}`));
    process.exit(1);
  }
}
