import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';

interface Snapshot {
  id: string;
  timestamp: string;
  backend: {
    commit: string;
    version: string;
    openapiHash: string;
  };
  frontend: {
    commit: string;
    version: string;
  };
}

/**
 * binder upgrade analyzes snapshots to identify breaking changes and
 * generates a migration plan.
 */
export async function runUpgrade() {
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
  
  if (!existsSync(snapshotsDir)) {
    logger.error('No snapshots found. Run "binder snapshot" first.');
    return;
  }

  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort();
  
  if (files.length < 2) {
    logger.info('Not enough snapshots to perform an upgrade analysis.');
    return;
  }

  const prevFile = files[files.length - 2];
  const currFile = files[files.length - 1];

  const prev = JSON.parse(readFileSync(join(snapshotsDir, prevFile), 'utf-8')) as Snapshot;
  const curr = JSON.parse(readFileSync(join(snapshotsDir, currFile), 'utf-8')) as Snapshot;

  logger.info(`Analyzing upgrade from ${pc.bold(prev.backend.version)} to ${pc.bold(curr.backend.version)}...`);

  const plan = {
    from: prev.backend.version,
    to: curr.backend.version,
    timestamp: new Date().toISOString(),
    changes: [] as string[],
    recommendations: [] as string[]
  };

  if (prev.backend.openapiHash !== curr.backend.openapiHash) {
    plan.changes.push('OpenAPI schema has changed.');
    plan.recommendations.push('Run "binder bind --repo" to update frontend hooks.');
  } else {
    plan.changes.push('No schema changes detected.');
  }

  const planPath = resolve(process.cwd(), 'binder', 'upgrade-plan.json');
  if (!existsSync(resolve(process.cwd(), 'binder'))) {
    const fs = await import('fs');
    fs.mkdirSync(resolve(process.cwd(), 'binder'), { recursive: true });
  }

  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  
  logger.success(`Migration plan generated at ${pc.bold('binder/upgrade-plan.json')}`);
  
  console.log(pc.cyan('\n📊 UPGRADE SUMMARY:'));
  plan.changes.forEach(c => console.log(pc.yellow(`  • ${c}`)));
  console.log(pc.green('\n💡 RECOMMENDATIONS:'));
  plan.recommendations.forEach(r => console.log(pc.white(`  • ${r}`)));
}
