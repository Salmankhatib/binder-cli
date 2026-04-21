import { logger } from '../utils/logger.js';

export interface HeuristicMatch {
  mockName: string;
  hookName: string;
  confidence: number;
}

export function heuristicMatch(mocks: Array<{ name: string }>, hooks: string[]): Array<HeuristicMatch | null> {
  logger.system('Running heuristic pattern matcher...');
  
  // Deduplicate mocks by name to avoid redundant LLM calls
  const uniqueMocks = Array.from(new Map(mocks.map(m => [m.name, m])).values());

  return uniqueMocks.map(mock => {
    const mockNorm = normalizeName(mock.name);
    let best: HeuristicMatch | null = null;

    for (const hook of hooks) {
      const hookNorm = normalizeName(hook);
      
      // Exact match
      if (mockNorm === hookNorm) {
        return { mockName: mock.name, hookName: hook, confidence: 1.0 };
      }
      
      // Contains match (e.g., "sales" in "getSales")
      if (hookNorm.includes(mockNorm) || mockNorm.includes(hookNorm)) {
        const confidence = 0.85;
        if (!best || confidence > best.confidence) {
          best = { mockName: mock.name, hookName: hook, confidence };
        }
      }
      
      // Fuzzy match
      const dist = levenshtein(mockNorm, hookNorm);
      const maxLen = Math.max(mockNorm.length, hookNorm.length);
      const similarity = 1 - dist / maxLen;
      
      if (similarity > 0.7) {
        const confidence = similarity;
        if (!best || confidence > best.confidence) {
          best = { mockName: mock.name, hookName: hook, confidence };
        }
      }
    }
    
    return best;
  });
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