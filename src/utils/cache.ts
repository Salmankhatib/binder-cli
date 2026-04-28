import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { logger } from './logger.js';
import { createHash } from 'crypto';

interface GlobalRule { mockName: string; hookName: string; count: number; }
interface CacheSchema {
  bindings: Record<string, { hookName: string; transformer: string | null }>;
  rules: GlobalRule[];
}

const CACHE_DIR = resolve(process.cwd(), '.binder');
const CACHE_FILE = resolve(CACHE_DIR, 'cache.json');

function ensureCache(): CacheSchema {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  if (!existsSync(CACHE_FILE)) {
    const fresh = { bindings: {}, rules: [] };
    writeFileSync(CACHE_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    return { 
        bindings: data.bindings || {}, 
        rules: data.rules || [] 
    };
  } catch (e) {
    return { bindings: {}, rules: [] };
  }
}

export function getCachedBinding(filePath: string, mockName: string) {
  const cache = ensureCache();
  // Check file-specific first
  const fileSpecific = cache.bindings[`${getHash(filePath)}:${mockName}`];
  if (fileSpecific) return fileSpecific;

  // Check global rules
  const globalRule = cache.rules.find(r => r.mockName === mockName);
  if (globalRule && globalRule.count > 1) {
    return { hookName: globalRule.hookName, transformer: null, isGlobal: true };
  }
  return null;
}

export function saveBinding(filePath: string, mockName: string, binding: any) {
  const cache = ensureCache();
  cache.bindings[`${getHash(filePath)}:${mockName}`] = binding;
  
  // Record/Boost global rule
  const existingGlobal = cache.rules.find(r => r.mockName === mockName && r.hookName === binding.hookName);
  if (existingGlobal) {
    existingGlobal.count++;
  } else {
    cache.rules.push({ mockName, hookName: binding.hookName, count: 1 });
  }

  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function getHash(str: string) { return createHash('md5').update(str).digest('hex').slice(0, 8); }
