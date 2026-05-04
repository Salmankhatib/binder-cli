// src/engine/scoring/contextScorer.ts
import { MockFinding, ProjectContext } from '../types.js';
import { extractEntity } from '../../match/contextualMatcher.js';

export interface ContextScoreResult {
  score: number;
  folderMatch: boolean;
  styleMatch: boolean;
  explanation: string;
}

export class ContextScorer {
  score(mock: MockFinding, projectContext: ProjectContext): ContextScoreResult {
    const mockEntity = extractEntity(mock.name);
    const folder = projectContext.folderContext.toLowerCase();
    const fileName = projectContext.filePath.split('/').pop()?.toLowerCase() || '';
    
    const folderMatch = folder.includes(mockEntity) || fileName.includes(mockEntity);
    const styleMatch = this.detectStyleCompatibility(mock, projectContext);

    let score = 0;
    if (folderMatch) score += 5;
    if (styleMatch) score += 3;
    if (projectContext.dependencies.includes('@tanstack/react-query')) score += 2;

    return {
      score,
      folderMatch,
      styleMatch,
      explanation: `Folder match: ${folderMatch}, Style match: ${styleMatch}, Stack: react-query`
    };
  }

  private detectStyleCompatibility(mock: MockFinding, context: ProjectContext): boolean {
    // Check if mock shape matches detected project style
    if (context.detectedStyle.includes('Skeleton') && mock.inferredShape) {
      return true; // Project has loading states, our guards will fit
    }
    return false;
  }
}
