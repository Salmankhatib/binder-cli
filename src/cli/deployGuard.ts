import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';

/**
 * binder deploy-guard checks the latest snapshot status.
 * Exits with code 1 if the contract is not verified.
 */
export async function runDeployGuard() {
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
  
  if (!existsSync(snapshotsDir)) {
    logger.error('No snapshots found. Cannot verify deployment safety.');
    process.exit(1);
  }

  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    logger.error('No snapshots found in .binder/snapshots/.');
    process.exit(1);
  }

  const latestFile = files[files.length - 1];
  const latest = JSON.parse(readFileSync(join(snapshotsDir, latestFile), 'utf-8'));

  if (latest.status === 'verified') {
    logger.success(`🚀 DEPLOYMENT GUARD: VERIFIED (Snapshot ${latest.id})`);
    console.log(pc.green('   Contracts are in sync. Deployment is safe.\n'));
  } else {
    logger.error(`🚨 DEPLOYMENT GUARD: FAILED (Snapshot ${latest.id} is ${latest.status})`);
    console.log(pc.red('   Contracts are drifting or unverified. Deployment aborted.'));
    console.log(pc.yellow('\n💡 Run "binder drift" to identify the issues.'));
    process.exit(1);
  }
}
