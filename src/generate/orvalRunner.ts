import  generateSpecs from 'orval';
import { resolve, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { logger } from '../utils/logger.js';

export async function runOrval(
  schemaPath: string,
  outputDir: string,
  orvalConfig: { client: string; baseUrl?: string }
): Promise<{ types: string; api: string; hooks: string }> {
  logger.startSpinner('Generating type-safe API client via Orval...');
  
  const absoluteOutDir = resolve(outputDir);
  
  if (!existsSync(absoluteOutDir)) {
    mkdirSync(absoluteOutDir, { recursive: true });
  }

  try {
    await generateSpecs({
      input: {
        target: schemaPath,
      },
      output: {
        target: resolve(absoluteOutDir, 'api.ts'),
        schemas: resolve(absoluteOutDir, 'model'),
        client: orvalConfig.client as any,
        override: {
          mutator: orvalConfig.baseUrl ? {
            name: 'custom-instance',
            path: resolve(absoluteOutDir, 'custom-instance.ts'),
          } : undefined,
          useNamedParameters: true,
        },
      },
    });

    const result = {
      types: resolve(absoluteOutDir, 'model'),
      api: resolve(absoluteOutDir, 'api.ts'),
      hooks: resolve(absoluteOutDir, orvalConfig.client === 'react-query' ? 'api.ts' : 'api.ts'),
    };

    logger.stopSpinner(true, `Client generated: ${orvalConfig.client}`);
    logger.system(`Output: ${absoluteOutDir}`);

    return result;
  } catch (err) {
    logger.failSpinner('Orval generation failed');
    throw new Error(`Orval failed: ${(err as Error).message}`);
  }
}