import { logger } from '../utils/logger.js';

export interface HeuristicMatch {
  mockName: string;
  hookName: string;
  confidence: number;
}

export function heuristicMatch(
  mocks: Array<{ name: string; snippet?: string; source?: string; resolvedContent?: string }>, 
  hooks: string[],
  filePath: string = ""
): Array<HeuristicMatch | null> {
  logger.system('Running context-aware heuristic matcher...');
  
  const uniqueMocks = Array.from(new Map(mocks.map(m => [m.name, m])).values());

  return uniqueMocks.map(mock => {
    const mockNorm = normalizeName(mock.name);
    let best: HeuristicMatch | null = null;

    // Folder Context (e.g., /users/ -> prioritize user hooks)
    const folderContext = filePath.toLowerCase();

    for (const hook of hooks) {
      const hookNorm = normalizeName(hook);
      let weight = 0;

      // 1. Name Similarity (Levenshtein)
      const dist = levenshtein(mockNorm, hookNorm);
      const maxLen = Math.max(mockNorm.length, hookNorm.length);
      const similarity = maxLen === 0 ? 0 : 1 - dist / maxLen;
      weight += similarity * 0.7; 

      // 1.5 Substring Boost (+40% for strong sub-matches)
      if (mockNorm === hookNorm) {
          weight += 0.6; // Increased from 0.5
      } else if (hookNorm.includes(mockNorm) || mockNorm.includes(hookNorm)) {
          weight += 0.45; // Increased from 0.35
      }

      // 2. Folder Context Boost (+15%)
      const hookKeyword = hookNorm.replace('use_', '');
      if (hookKeyword && folderContext.includes(hookKeyword)) {
          weight += 0.15;
      }

      // 3. Value-Type Fingerprinting (if resolved content available)
      if (mock.resolvedContent) {
          const mockTags = fingerprint(mock.resolvedContent);
          const hookTags = fingerprint(hook); // Check hook name for type clues
          const intersection = mockTags.filter(t => hookTags.includes(t));
          if (intersection.length > 0) weight += 0.2;
      }

      const confidence = Math.min(weight, 1.0);

      if (confidence >= 0.5) { 
        if (!best || confidence > best.confidence) {
          best = { mockName: mock.name, hookName: hook, confidence };
        }
      }
    }
    
    return best;
  });
}

function fingerprint(text: string): string[] {
    const tags: string[] = [];
    if (text.includes('@')) tags.push('EMAIL');
    if (text.match(/\d{4}-\d{2}/)) tags.push('DATE');
    if (text.match(/[0-9a-f]{8}-/)) tags.push('UUID');
    
    // NEW FINGERPRINTS
    if (text.match(/https?:\/\//)) tags.push('URL');
    if (text.match(/^\d+(\.\d+)?$/)) tags.push('NUMBER');
    if (text.match(/true|false/)) tags.push('BOOLEAN');
    if (text.match(/^(Mr|Mrs|Ms|Dr)\./i)) tags.push('NAME_PREFIX');
    if (text.length > 200) tags.push('LONG_TEXT');
    if (text.match(/data:image|base64/)) tags.push('BINARY');
    if (text.match(/^[A-Z]{2,3}-\d{3,}$/)) tags.push('SKU_CODE');
    
    return tags;
}

export function normalizeName(str: string): string {
  return str
    .replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_|useGet|useFetch|useCreate|useLoad|use)/i, '')
    .replace(/_(DATA|LIST|ARRAY|ITEMS|SET)$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
    }
  }
  return matrix[b.length][a.length];
}   