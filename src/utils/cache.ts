import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { logger } from './logger.js';
import { createHash } from 'crypto';

interface GlobalRule { mockName: string; hookName: string; count: number; }
interface LearnedPattern { signature: string; strategy: string; count: number; }
interface CacheSchema {
  bindings: Record<string, { hookName: string; transformer: string | null }>;
  rules: GlobalRule[];
  patterns: LearnedPattern[];
}

const CACHE_DIR = resolve(process.cwd(), '.binder');
const CACHE_FILE = resolve(CACHE_DIR, 'cache.json');

let inMemoryCache: CacheSchema | null = null;

function ensureCache(): CacheSchema {
  if (inMemoryCache) return inMemoryCache;

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  
  if (!existsSync(CACHE_FILE)) {
    inMemoryCache = { bindings: {}, rules: [], patterns: [] };
    return inMemoryCache;
  }

  try {
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    inMemoryCache = { 
        bindings: data.bindings || {}, 
        rules: data.rules || [],
        patterns: data.patterns || []
    };
    return inMemoryCache;
  } catch (e) {
    inMemoryCache = { bindings: {}, rules: [], patterns: [] };
    return inMemoryCache;
  }
}

/**
 * Persists the in-memory cache to disk.
 * Should be called at the end of a CLI session.
 */
export function flushCache() {
  if (!inMemoryCache) return;
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(inMemoryCache, null, 2));
  } catch (e: any) {
    logger.error(`Failed to flush cache: ${e.message}`);
  }
}

export function getLearnedStrategy(signature: string): string | null {
    const cache = ensureCache();
    const pattern = cache.patterns.find(p => p.signature === signature);
    return (pattern && pattern.count >= 2) ? pattern.strategy : null;
}

export function recordPatternSuccess(signature: string, strategy: string) {
    const cache = ensureCache();
    const existing = cache.patterns.find(p => p.signature === signature);
    if (existing) {
        if (existing.strategy === strategy) existing.count++;
    } else {
        cache.patterns.push({ signature, strategy, count: 1 });
    }
    // We no longer write to disk on every record for performance
}

export function getCachedBinding(filePath: string, mockName: string) {
  const cache = ensureCache();
  const fileSpecific = cache.bindings[`${getHash(filePath)}:${mockName}`];
  if (fileSpecific) return fileSpecific;

  const globalRule = cache.rules.find(r => r.mockName === mockName);
  if (globalRule && globalRule.count > 1) {
    return { hookName: globalRule.hookName, transformer: null, isGlobal: true };
  }
  return null;
}

export function saveBinding(filePath: string, mockName: string, binding: any) {
  const cache = ensureCache();
  cache.bindings[`${getHash(filePath)}:${mockName}`] = binding;
  
  const existingGlobal = cache.rules.find(r => r.mockName === mockName && r.hookName === binding.hookName);
  if (existingGlobal) {
    existingGlobal.count++;
  } else {
    cache.rules.push({ mockName, hookName: binding.hookName, count: 1 });
  }
}

function getHash(str: string) { return createHash('md5').update(str).digest('hex').slice(0, 8); }
