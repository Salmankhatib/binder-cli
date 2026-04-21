import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { logger } from './logger.js';
import { createHash } from 'crypto';

interface GlobalRule { pattern: string; fix: string; count: number; }
interface CacheSchema {
  bindings: Record<string, { hookName: string; transformer: string | null }>;
  memory: string[];
  rules: GlobalRule[];
}

const CACHE_DIR = resolve(process.cwd(), '.binder');
const CACHE_FILE = resolve(CACHE_DIR, 'cache.json');

function ensureCache(): CacheSchema {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  if (!existsSync(CACHE_FILE)) {
    const fresh = { bindings: {}, memory: [], rules: [] };
    writeFileSync(CACHE_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    return { 
        bindings: data.bindings || {}, 
        memory: data.memory || [], 
        rules: data.rules || [] 
    };
  } catch (e) {
    return { bindings: {}, memory: [], rules: [] };
  }
}

export function getCachedBinding(filePath: string, mockName: string) {
  const cache = ensureCache();
  return cache.bindings[`${getHash(filePath)}:${mockName}`] || null;
}

export function saveBinding(filePath: string, mockName: string, binding: any) {
  const cache = ensureCache();
  cache.bindings[`${getHash(filePath)}:${mockName}`] = binding;
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function recordRule(oldField: string, newField: string) {
    const cache = ensureCache();
    const existing = cache.rules.find(r => r.pattern === oldField && r.fix === newField);
    if (existing) { existing.count++; } 
    else { cache.rules.push({ pattern: oldField, fix: newField, count: 1 }); }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function getGlobalRules(): string {
    const cache = ensureCache();
    return cache.rules.filter(r => r.count >= 1).map(r => `- ${r.pattern} -> ${r.fix}`).join('\n');
}

export function recordSuccess(filePath: string, code: string) {
  const cache = ensureCache();
  const snippet = code.split('\n').slice(0, 20).join('\n');
  if (!cache.memory.includes(snippet)) {
    cache.memory.push(snippet);
    if (cache.memory.length > 5) cache.memory.shift();
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  }
}

function getHash(str: string) { return createHash('md5').update(str).digest('hex').slice(0, 8); }
