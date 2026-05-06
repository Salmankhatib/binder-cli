import { describe, it, expect, beforeAll } from 'vitest';
import { calculateLastKnownGood } from '../src/analysis/rollbackIntelligence.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

describe('Rollback Intelligence', () => {
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');

  beforeAll(() => {
    if (!existsSync(snapshotsDir)) mkdirSync(snapshotsDir, { recursive: true });

    // 1. A failed snapshot
    const failed = {
      id: 'failed-1',
      timestamp: '2026-05-06T10:00:00Z',
      backend: { version: 'v2.5.0', status: 'failed' },
      frontend: { version: 'v4.3.0', status: 'verified' }
    };

    // 2. A verified snapshot (The Last Known Good)
    const verified = {
      id: 'verified-1',
      timestamp: '2026-05-05T10:00:00Z',
      backend: { version: 'v2.4.0', status: 'verified' },
      frontend: { version: 'v4.2.8', status: 'verified' }
    };

    writeFileSync(join(snapshotsDir, '2026-05-06T10-00-00Z.json'), JSON.stringify(failed));
    writeFileSync(join(snapshotsDir, '2026-05-05T10-00-00Z.json'), JSON.stringify(verified));
  });

  it('should identify the correct last known good version', async () => {
    const advice = await calculateLastKnownGood();
    expect(advice).not.toBeNull();
    expect(advice?.safeVersion).toBe('v2.4.0');
    expect(advice?.instructions).toContain('git checkout v4.2.8');
  });
});
