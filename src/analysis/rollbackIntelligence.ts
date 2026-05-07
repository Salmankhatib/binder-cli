import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

interface Snapshot {
  id: string;
  timestamp: string;
  backend: {
    version: string;
    openapiHash: string;
    status?: 'verified' | 'failed';
  };
  frontend: {
    version: string;
    status?: 'verified' | 'failed';
  };
}

export interface RollbackAdvice {
  safeVersion: string;
  safeSnapshot: Snapshot;
  instructions: string[];
}

/**
 * rollbackIntelligence analyzes snapshot history to find the most recent 
 * fully verified frontend-backend pair.
 */
export async function calculateLastKnownGood(): Promise<RollbackAdvice | null> {
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
  if (!existsSync(snapshotsDir)) return null;

  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort().reverse();
  const snapshots = files.map(f => JSON.parse(readFileSync(join(snapshotsDir, f), 'utf-8')) as Snapshot);

  // Find the first snapshot where both were verified (or the latest if no status is present yet)
  // In a real environment, the CI would mark these statuses.
  const lastGood = snapshots.find(s => 
    s.backend.status !== 'failed' && s.frontend.status !== 'failed'
  );

  if (!lastGood) return null;

  return {
    safeVersion: lastGood.backend.version,
    safeSnapshot: lastGood,
    instructions: [
      `git checkout ${lastGood.frontend.version}`,
      `npm install`,
      `binder snapshot --verify`
    ]
  };
}
