import { readFileSync, readdirSync, existsSync, join } from 'fs';
import { resolve } from 'path';

export interface Pattern {
  name: string;
  template: string; // raw string with placeholders like {{hookName}}, {{zodSchema}}, etc.
}

/**
 * Load all JSON/YAML pattern files under the project's `.binder/patterns` folder.
 * Returns a map keyed by the pattern file name (without extension).
 */
export function loadPatterns(): Record<string, Pattern> {
  const patternsDir = resolve(process.cwd(), '.binder', 'patterns');
  if (!existsSync(patternsDir)) {
    return {};
  }

  const files = readdirSync(patternsDir).filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
  const result: Record<string, Pattern> = {};

  for (const file of files) {
    const fullPath = join(patternsDir, file);
    try {
      const raw = readFileSync(fullPath, 'utf-8');
      const parsed = file.endsWith('.json') ? JSON.parse(raw) : require('js-yaml').load(raw);
      if (parsed && typeof parsed.template === 'string') {
        const key = file.replace(/\.(json|yaml|yml)$/, '');
        result[key] = { name: parsed.name || key, template: parsed.template };
      }
    } catch (e) {
      // Silently ignore malformed pattern files – they will be reported later when a user selects the pattern.
    }
  }
  return result;
}
