import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import type { Config } from './types.js';

const configSchema = z.object({
  backend: z.object({
    schemaPath: z.string(),
    url: z.string().url().optional()
  }),
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

function findUp(filename: string, startDir: string): string | null {
  let currentDir = resolve(startDir);
  while (true) {
    const fullPath = join(currentDir, filename);
    if (existsSync(fullPath)) return fullPath;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return null;
}

export async function loadConfig(
  configPath: string,
  cliOverrides?: Partial<Config>
): Promise<Config> {
  let resolvedPath: string | null = null;

  if (configPath === './binder.config.json') {
    resolvedPath = findUp('binder.config.json', process.cwd());
  } else {
    resolvedPath = resolve(configPath);
    if (!existsSync(resolvedPath)) {
        resolvedPath = null;
    }
  }

  if (!resolvedPath) {
    const msg = `Config file not found. Run "binder init" or provide --config path.`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.step('🔍', `Loading config from ${resolvedPath}`);

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

  const finalConfig = result.data;
  const configDir = dirname(resolvedPath);

  // Resolve relative paths in config relative to the config file
  if (finalConfig.backend.schemaPath && !finalConfig.backend.schemaPath.startsWith('http')) {
    finalConfig.backend.schemaPath = resolve(configDir, finalConfig.backend.schemaPath);
  }
  if (finalConfig.frontend.generatedDir) {
    finalConfig.frontend.generatedDir = resolve(configDir, finalConfig.frontend.generatedDir);
  }

  logger.success('Config loaded successfully');
  return finalConfig;
}

export function validateConfig(config: unknown): asserts config is Config {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
}