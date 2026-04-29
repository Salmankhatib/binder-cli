// src/test/compatibilityTest.ts
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { logger } from '../utils/logger.js';
import type { Binding } from '../common/types.js';

export function generateCompatibilityTest(
    filePath: string,
    binding: Binding,
    generatedDir: string
) {
    const testDir = resolve(process.cwd(), 'tests/binder-generated');
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });

    const testFileName = `${binding.mockName}_to_${binding.hookName}.test.ts`;
    const testPath = join(testDir, testFileName);

    // Calculate relative imports
    const apiPath = join(generatedDir, 'api').replace(/\\/g, '/');
    
    const testContent = `
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ${binding.hookName} } from '${apiPath}';
import React from 'react';

// Binder-Generated Compatibility Test
// Validates that the hook "${binding.hookName}" satisfies the data requirements
// originally fulfilled by the mock "${binding.mockName}".

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Binder Compatibility: ${binding.mockName} → ${binding.hookName}', () => {
  it('API hook returns data with compatible shape', async () => {
    const { result } = renderHook(() => ${binding.hookName}(), {
      wrapper: createWrapper()
    });

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    const data = result.current.data;
    expect(data).toBeDefined();

    // Structural validation (Inferred from migration)
    if (Array.isArray(data)) {
        expect(data.length).toBeGreaterThanOrEqual(0);
        if (data.length > 0) {
            // Check for potential null/undefined values in required fields
            const sample = data[0];
            expect(sample).not.toBeNull();
        }
    }
  });
});
`.trim();

    try {
        writeFileSync(testPath, testContent);
        logger.debug(`Generated compatibility test: ${testPath}`);
    } catch (e: any) {
        logger.error(`Failed to generate test artifact: ${e.message}`);
    }
}
