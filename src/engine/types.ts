// src/engine/types.ts
import { Identifier, Node } from 'ts-morph';
import { Binding } from '../common/types.js';
import { MockFinding } from '../scan/mockScanner.js';
import { UsageContext as Usage } from '../analysis/usageFinder.js';

export { MockFinding, Usage };

export interface ProjectContext {
  filePath: string;
  folderContext: string;
  imports: string[];
  dependencies: string[];
  detectedStyle: string;
  tsConfigPath: string | null;
}

export interface ReasoningChain {
  layer: 'pattern' | 'match' | 'type' | 'semantic' | 'project-context';
  score: number;
  maxScore: number;
  explanation: string;
  details?: Record<string, unknown>;
}

export interface HumanOption {
  id: string;
  label: string;
  description: string;
  consequence: ConsequencePreview;
  confidence: number;
  effortEstimate: 'low' | 'medium' | 'high';
  riskLevel: 'safe' | 'caution' | 'breaking';
}

export interface ConsequencePreview {
  codeDiff: string;
  typeCheckResult: 'pass' | 'fail' | 'unknown';
  performanceImpact: string;
  architecturalChange: string;
  filesModified: string[];
}

export interface TodoContext {
  reason: string;
  explanation: string;
  suggestedSteps: string[];
  estimatedEffort: 'low' | 'medium' | 'high' | 'unknown';
  relatedFiles?: string[];
}

export type DecisionType = 'auto' | 'human' | 'todo';

export interface Decision {
  type: DecisionType;
  confidence: number;
  reasoning: ReasoningChain[];
  options?: HumanOption[];
  todoContext?: TodoContext;
  binding?: Binding;
}
