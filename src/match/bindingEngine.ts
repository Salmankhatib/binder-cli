import { heuristicMatch } from '../ai/heuristicMatcher.js';
import { semanticMatch } from './semanticMatcher.js';
import { callLLM } from '../ai/llmClient.js';
import { buildMatchingPrompt } from '../ai/promptBuilder.js';
import { parseBindingPlan, type BindingPlan } from '../ai/responseParser.js';
import { getCachedBinding, saveBinding } from '../utils/cache.js';
import { generateContext } from '../utils/contextManager.js';
import type { MockFinding } from '../scan/mockScanner.js';
import type { Config } from '../config/types.js';
import { logger } from '../utils/logger.js';
import { resolve, join } from 'path';

export interface HookSignature {
  name: string;
  method: string;
  path: string;
  responseType: string;
  params?: Array<{ name: string; type: string; required: boolean }>;
}

export async function createBindingPlan(
  mocks: MockFinding[],
  hooks: HookSignature[],
  sourceFilePath: string,
  config: Config,
  apiContent: string
): Promise<BindingPlan> {
  logger.startSpinner('Building Intelligent Binding Plan...');
  
  const finalBindings: any[] = [];
  const cacheHitMocks: string[] = [];

  // 1. Cache Layer
  for (const mock of mocks) {
    const cached = getCachedBinding(sourceFilePath, mock.name);
    if (cached) {
      finalBindings.push({ mockName: mock.name, ...cached, confidence: 1.0 });
      cacheHitMocks.push(mock.name);
    }
  }

  const unmatched = mocks.filter(m => !cacheHitMocks.includes(m.name));
  if (unmatched.length === 0) {
    logger.stopSpinner(true, 'Recovered from persistent memory');
    return buildPlanFromMatches(mocks, finalBindings);
  }

  // 2. Deterministic Layers (Semantic + Heuristic)
  const semanticMatches = semanticMatch(unmatched, hooks, apiContent);
  const matchedViaSemantic = new Set(semanticMatches.map(m => m.mockName));
  
  const remaining = unmatched.filter(m => !matchedViaSemantic.has(m.name));
  const heuristicMatches = heuristicMatch(remaining, hooks.map(h => h.name));
  const highConfHeuristic = heuristicMatches.filter((m): m is any => m !== null && m.confidence >= 0.85);
  
  const matchedViaHeuristic = new Set(highConfHeuristic.map(m => m.mockName));
  const trulyUnmatched = remaining.filter(m => !matchedViaHeuristic.has(m.name));

  // 3. LLM Atomic Layer (ONLY if heuristics fail)
  let llmBindings: any[] = [];
  if (trulyUnmatched.length > 0) {
    logger.system(`  Heuristics failed for ${trulyUnmatched.length} mocks. Escalating to Atomic LLM...`);
    
    // Generate Repo Map for AI
    const context = generateContext(config.frontend.generatedDir, sourceFilePath);
    
    const prompt = buildAtomicMatchingPrompt(sourceFilePath, trulyUnmatched, hooks, context);
    const response = await callLLM(prompt, config.llm);
    const plan = parseBindingPlan(response);
    llmBindings = plan.bindings;
  }

  const allMatches = [
    ...finalBindings,
    ...semanticMatches,
    ...highConfHeuristic,
    ...llmBindings
  ];

  // Save all new matches to cache
  allMatches.forEach(m => saveBinding(sourceFilePath, m.mockName, { hookName: m.hookName, transformer: m.transformer }));

  logger.stopSpinner(true, `Binding plan delivered (${allMatches.length} targets)`);
  return buildPlanFromMatches(mocks, allMatches);
}

function buildAtomicMatchingPrompt(file: string, mocks: MockFinding[], hooks: HookSignature[], context: string): string {
  return `You are a Repo-Aware Binding Agent. Use the following context to match mocks.

${context}

TARGET MOCKS:
${mocks.map(m => `- ${m.name}: ${m.snippet}`).join('\n')}

INSTRUCTIONS:
Match each mock to a hook. Provide an atomic transformer if the data shape differs.
Respond with JSON only.`;
}

function buildPlanFromMatches(mocks: MockFinding[], matches: any[]): BindingPlan {
  return {
    bindings: matches,
    importsToRemove: [], // Calculated by rewriter
    importsToAdd: []     // Calculated by rewriter
  };
}
