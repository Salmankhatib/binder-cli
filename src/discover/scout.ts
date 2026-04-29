import glob from 'fast-glob';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { logger } from '../utils/logger.js';
import type { Config } from '../config/types.js';

export interface ProjectMap {
  tree: string[];
  packageJson: any;
  mainDependencies: string[];
}

/**
 * The Scout (Discovery Phase)
 * Crawls the tree, finds openapi.json, and reads package.json.
 */
export async function discoveryPhase(config: Config): Promise<ProjectMap> {
  logger.startSpinner("📡 Scout: Mapping repository structure...");

  // 1. Recursive search for openapi.json if missing at configured path
  if (config.backend.schemaPath && !config.backend.schemaPath.startsWith('http') && !existsSync(config.backend.schemaPath)) {
    logger.info("Schema missing at configured path. Searching workspace...");
    const results = await glob("**/openapi.json", { 
        ignore: ['**/node_modules/**', '**/.git/**'],
        absolute: true 
    });
    
    if (results.length > 0) {
      config.backend.schemaPath = results[0];
      logger.success(`Found schema at ${results[0]}`);
    }
  }

  // 2. Build Project Map (Tree)
  const files = await glob(["src/**/*.{ts,tsx}", "package.json"], { 
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'] 
  });

  // 3. Read package.json
  let packageJson = {};
  const pkgPath = resolve(process.cwd(), "package.json");
  if (existsSync(pkgPath)) {
    packageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  }

  const mainDeps = Object.keys((packageJson as any).dependencies || {});

  logger.stopSpinner(true, "Discovery complete. Repository map established.");

export function detectMonorepo(): { type: string, packages: string[] } | null {
  if (existsSync('pnpm-workspace.yaml')) {
    // Simplified pnpm discovery
    return { type: 'pnpm', packages: [] };
  }
  
  const pkgPath = resolve(process.cwd(), "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (pkg.workspaces) {
      return { type: 'npm', packages: Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages || [] };
    }
  }
  
  if (existsSync('turbo.json')) {
    return { type: 'turborepo', packages: [] };
  }
  
  if (existsSync('nx.json')) {
    return { type: 'nx', packages: [] };
  }
  
  return null;
}
