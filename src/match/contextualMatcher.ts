// src/match/contextualMatcher.ts
import { SourceFile } from 'ts-morph';
import { dirname, basename, extname } from 'path';
import type { MockFinding } from '../scan/mockScanner.js';
import { normalizeName } from './heuristicMatcher.js';

export interface ContextualMatch {
  hookName: string;
  confidence: number;
}

export function contextualMatch(
  mock: MockFinding, 
  filePath: string,
  sourceFile: SourceFile,
  hookNames: string[]
): ContextualMatch[] {
  const folder = dirname(filePath).toLowerCase();
  const mockEntity = extractEntity(mock.name);
  const fileName = basename(filePath, extname(filePath)).toLowerCase();
  
  const imports = sourceFile.getImportDeclarations()
    .map(i => i.getModuleSpecifierValue().toLowerCase());
  
  return hookNames.map(hookName => {
    let score = 0;
    const hookNorm = normalizeName(hookName);
    
    // Folder context: /pages/users/ → useGetUsers
    if (folder.includes(mockEntity) && hookNorm.includes(mockEntity)) score += 0.3;
    
    // Import context: imports from '@/features/users'
    if (imports.some(i => i.includes(mockEntity)) && hookNorm.includes(mockEntity)) score += 0.2;
    
    // File name context: UserList.tsx → useGetUsers
    if (fileName.includes(mockEntity) && hookNorm.includes(mockEntity)) score += 0.15;
    
    return { hookName, confidence: Math.min(score, 0.65) };
  });
}

export function extractEntity(name: string): string {
    return normalizeName(name)
        .replace(/^(get|fetch|load|create|update|delete|remove|post|put|patch)/i, '')
        .replace(/(list|data|items|collection|results|array|set)$/i, '');
}
