import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import type { Config } from './types.js';

const configSchema = z.object({
  backend: z.object({
    python: z.string().optional(),
    url: z.string().url().optional()
  }).refine(
    (data) => data.python || data.url,
    { message: 'Either backend.python or backend.url must be specified' }
  ),
  frontend: z.object({
    generatedDir: z.string().default('./src/generated')
  }),
  orval: z.object({
    client: z.enum(['react-query', 'swr', 'vue-query']).default('react-query'),
    baseUrl: z.string().optional()
  }),
  llm: z.object({
    provider: z.enum(['ollama', 'openai', 'gemini']).default('ollama'),
    model: z.string().default('codellama:13b'),
    host: z.string().default('http://localhost:11434'),
    temperature: z.number().min(0).max(1).default(0.2),
    maxRetries: z.number().min(1).max(5).default(3)
  }),
  mcpServers: z.array(z.object({
    name: z.string(),
    command: z.string(),
    args: z.array(z.string())
  })).optional()
});

export async function loadConfig(
  configPath: string,
  cliOverrides?: Partial<Config>
): Promise<Config> {
  logger.step('🔍', `Loading config from ${configPath}`);

  const resolvedPath = resolve(configPath);

  if (!existsSync(resolvedPath)) {
    logger.error(`Config file not found: ${resolvedPath}`);
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  let rawConfig: unknown;
  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    rawConfig = JSON.parse(content);
  } catch (err) {
    logger.error(`Failed to parse config: ${(err as Error).message}`);
    throw err;
  }

  const baseConfig = (rawConfig && typeof rawConfig === 'object') ? rawConfig : {};

const merged = {
    ...baseConfig,
    ...(cliOverrides || {})
  };

  const result = configSchema.safeParse(merged);

  if (!result.success) {
    logger.error('Config validation failed:');
    result.error.errors.forEach((err) => {
      logger.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    throw new Error('Invalid configuration');
  }

  logger.success('Config loaded successfully');
  return result.data;
}

export function validateConfig(config: unknown): asserts config is Config {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
}