import { describe, it, expect, vi, beforeAll } from 'vitest';
import { runDrift } from '../src/cli/drift.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// Mock logger to capture output
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    step: vi.fn(),
  }
}));

describe('Deep Drift Analysis', () => {
  beforeAll(() => {
    // Setup a mock config that points to our torture test schema
    const config = {
      backend: { schemaPath: 'tests/fixtures/driftSchema.json' },
      frontend: { generatedDir: './src/generated' }
    };
    writeFileSync(resolve(process.cwd(), 'binder.config.json'), JSON.stringify(config, null, 2));
  });

  it('should detect field-level and orphaned hook drift and exit with code 1', async () => {
    let exitCode: number | undefined;
    const realExit = process.exit;
    // @ts-ignore - intercept process.exit to verify the CI gate fires
    process.exit = (code?: number) => { exitCode = code; throw new Error(`process.exit(${code})`); };

    try {
      await runDrift();
    } catch (e: any) {
      // Expected — process.exit(1) means drift was detected
    } finally {
      process.exit = realExit;
    }

    expect(exitCode).toBe(1);
  });
});

import { collectAPICalls } from '../src/analysis/apiCallCollector.js';

describe('API Call Collector - Deep Trace', () => {
  it('should extract accessed properties from hardDrift.tsx', async () => {
    const calls = await collectAPICalls(resolve(process.cwd(), 'tests/fixtures'));
    const usersCall = calls.find(c => c.hookName === 'useGetUsers');
    const tasksCall = calls.find(c => c.hookName === 'useGetTasks');
    const legacyCall = calls.find(c => c.hookName === 'useGetOldLegacyData');

    expect(usersCall?.accessedProperties).toContain('name');
    expect(usersCall?.accessedProperties).toContain('email');
    expect(tasksCall?.accessedProperties).toContain('map'); // map is technically a property access
    expect(legacyCall?.accessedProperties).toContain('id');
  });
});
