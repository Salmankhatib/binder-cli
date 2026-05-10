// src/engine/decisionEngine.ts
import { MockFinding, Usage, ProjectContext, Decision, ReasoningChain } from './types.js';
import { PatternScorer } from './scoring/patternScorer.js';
import { MatchScorer } from './scoring/matchScorer.js';
import { TypeScorer } from './scoring/typeScorer.js';
import { ContextScorer } from './scoring/contextScorer.js';
import { PatternRegistry } from '../patterns/registry.js';
import { OptionsGenerator } from '../human/optionsGenerator.js';
import { TodoGenerator } from '../patterns/todo/todoGenerator.js';
import { LearningAccelerator } from '../learning/accelerator.js';
import { Binding } from '../common/types.js';
import { analyzeUsage } from '../analysis/usageAnalyzer.js';
import { analyzePropDrillingRisk } from '../analysis/propAnalyzer.js';
import { InputInferenceEngine } from '../analysis/inputInference.js';
import { OllamaFallback } from '../llm/fallback.js';

export class DecisionEngine {
  private patternScorer: PatternScorer;
  private matchScorer: MatchScorer;
  private typeScorer: TypeScorer;
  private contextScorer: ContextScorer;
  private patternRegistry: PatternRegistry;
  private optionsGenerator: OptionsGenerator;
  private todoGenerator: TodoGenerator;
  private accelerator: LearningAccelerator;
  private inputInference: InputInferenceEngine;

  constructor() {
    this.patternScorer = new PatternScorer();
    this.matchScorer = new MatchScorer();
    this.typeScorer = new TypeScorer();
    this.contextScorer = new ContextScorer();
    this.patternRegistry = new PatternRegistry();
    this.optionsGenerator = new OptionsGenerator();
    this.todoGenerator = new TodoGenerator();
    this.accelerator = new LearningAccelerator();
    this.inputInference = new InputInferenceEngine();
  }

  async decide(
    mock: MockFinding,
    usages: Usage[],
    projectContext: ProjectContext,
    hookNames: string[],
    apiContent: string,
    drills: any[] = [],
    trpcProcedures?: any,
    mutationTemplates?: Map<string, any>,
    customHookWrappers?: Map<string, any>
  ): Promise<Decision> {
    const chain: ReasoningChain[] = [];

    // PRIORITY 1: Usage Pattern Analysis
    const usageProfile = analyzeUsage(usages as any);
    
    // console.log(`[DEBUG] ${mock.name} patterns:`, usageProfile.patterns);

    chain.push({
        layer: 'project-context',
        score: usageProfile.isDangerous ? 2 : 10,
        maxScore: 10,
        explanation: `Usage Analysis: ${usageProfile.explanation.join(' ')}`,
        details: { patterns: usageProfile.patterns }
    });

    // PRIORITY 5: Cross-File Prop Detection
    const propRisk = analyzePropDrillingRisk(drills);
    if (drills.length > 0) {
      chain.push({
        layer: 'project-context',
        score: propRisk.isHighRisk ? 0 : 10, 
        maxScore: 10,
        explanation: propRisk.explanation + (propRisk.isHighRisk ? '' : ' Traced successfully to parent.'),
        details: { drills }
      });
    }

    // Layer 1: Pattern Safety (0-40 points)
    const patternResult: any = this.patternScorer.score(mock, usages, this.patternRegistry);
    chain.push({
      layer: 'pattern',
      score: patternResult.score,
      maxScore: 40,
      explanation: patternResult.explanation,
      details: { matchedPattern: patternResult.patternName, isAutoPattern: patternResult.isAuto }
    });

    // Layer 2: Hook Match Quality (0-30 points)
    const matchResult = await this.matchScorer.score(mock, hookNames, apiContent, projectContext, usageProfile, trpcProcedures);
    chain.push({
      layer: 'match',
      score: matchResult.score, // Correctly scaled in MatchScorer
      maxScore: 30,
      explanation: matchResult.explanation,
      details: { bestHook: matchResult.bestHook, matchConfidence: matchResult.confidence }
    });

    // Layer 3: Type Compatibility (0-20 points)
    const typeResult = this.typeScorer.score(mock, usages, apiContent, matchResult.bestHook);
    chain.push({
      layer: 'type',
      score: typeResult.score,
      maxScore: 20,
      explanation: typeResult.explanation,
      details: { typeCompatibility: typeResult.compatibility }
    });

    // Layer 4: Project Context (0-10 points)
    const contextResult = this.contextScorer.score(mock, projectContext);
    
    // PRIORITY 5: Prop Drilling handling
    let contextScore = contextResult.score;
    if (drills.length > 0 && propRisk.isHighRisk) {
        contextScore -= 5; // Penalty only if high risk
        chain.push({
            layer: 'project-context',
            score: -5,
            maxScore: 0,
            explanation: `Mock is prop-drilled into ${drills.length} components. Auto-binding may break the tree.`,
            details: { drills }
        });
    } else if (drills.length > 0) {
        chain.push({
            layer: 'project-context',
            score: 0,
            maxScore: 0,
            explanation: `Mock is prop-drilled, but traced successfully.`,
            details: { drills }
        });
    }

    chain.push({
      layer: 'project-context',
      score: Math.max(contextScore, 0),
      maxScore: 10,
      explanation: contextResult.explanation,
      details: { folderMatch: contextResult.folderMatch, styleMatch: contextResult.styleMatch }
    });

    // PRIORITY 2.1: Input Inference (for tRPC)
    let inferredInput = null;
    let needsInput = false;
    if (projectContext.protocol === 'trpc' && trpcProcedures && trpcProcedures.has(matchResult.bestHook)) {
        const proc = trpcProcedures.get(matchResult.bestHook);
        inferredInput = await this.inputInference.inferInput(usages[0].node, proc.inputSchema, usages[0].node.getSourceFile());
        
        if (inferredInput) {
            chain.push({
                layer: 'semantic',
                score: 20, 
                maxScore: 20,
                explanation: `Inferred input found: ${inferredInput.expression} from ${inferredInput.source}`,
                details: { inferredInput }
            });
        } else if (proc.inputSchema && proc.inputSchema !== 'void' && proc.inputSchema !== 'undefined') {
            needsInput = true;
            chain.push({
                layer: 'semantic',
                score: -5, 
                maxScore: 0,
                explanation: `Procedure requires input (${proc.inputSchema}) but none could be inferred.`,
                details: { needsInput: true }
            });
        }
    }

    (matchResult as any).needsInput = needsInput;

    const totalScore = chain.reduce((sum, c) => sum + c.score, 0);
    const maxScore = chain.reduce((sum, c) => sum + c.maxScore, 0);
    const normalizedScore = Math.min(Math.max((totalScore / maxScore) * 100, 0), 100);

    // Layer 5: Learning (Boost if we've seen this exact signature before)
    const prediction = this.accelerator.predict({
      mockName: mock.name,
      patternName: patternResult.patternName || '',
      structuralSignature: usages[0]?.structuralSignature || '',
      projectContext: projectContext.filePath
    });

    let finalScore = normalizedScore;
    if (prediction) {
      // SIGNIFICANT BOOST: 1.0 confidence for exact name matches from cache
      finalScore = 100; 
      chain.push({
        layer: 'semantic', 
        score: 10,
        maxScore: 10,
        explanation: `Learned pattern detected: ${prediction.choice}. Force auto-convert.`,
        details: { prediction }
      });
    }

    // Determine decision type
    // PRIORITY 4.1: Mutation Pattern Discovery
    let mutationTemplate = null;
    if (usages.some(u => u.isMutation)) {
        // In tRPC, hookNames might be user.create, user.list
        // We find the router name
        const bestHook = matchResult.bestHook;
        const router = bestHook.includes('.') ? bestHook.split('.')[0] : 'global';
        mutationTemplate = mutationTemplates?.get(router) || mutationTemplates?.get('global');
        
        if (mutationTemplate) {
            chain.push({
                layer: 'semantic',
                score: 10,
                maxScore: 10,
                explanation: `Found mutation template for router "${router}". Will auto-invalidate: ${mutationTemplate.invalidates.join(', ')}`,
                details: { mutationTemplate }
            });
        }
    }

    // PRIORITY 5.1: Custom Hook Wrapper Discovery
    if (customHookWrappers) {
        const wrapper = Array.from(customHookWrappers.values()).find((w: any) => w.wrappedHook === matchResult.bestHook);
        if (wrapper) {
            chain.push({
                layer: 'semantic',
                score: 20,
                maxScore: 20,
                explanation: `Discovered custom hook wrapper "${wrapper.name}" for "${matchResult.bestHook}". Preferring wrapper.`,
                details: { wrapper }
            });
            matchResult.bestHook = wrapper.name; // Swap to wrapper
        }
    }

    // Determine decision type
    if (patternResult.category === 'todo') {
      return {
        type: 'todo',
        confidence: finalScore / 100,
        reasoning: chain,
        todoContext: this.todoGenerator.generate(mock, usages, patternResult, matchResult)
      };
    }

    // v1.0.0 PRODUCTION DISCIPLINE: 
    const isAutoPattern = patternResult.isAuto;
    const isVerySafePattern = isAutoPattern && (patternResult.patternName === 'direct-assignment' || patternResult.patternName === 'simple-map' || patternResult.patternName === 'jsx-prop-direct');
    const isStrongMatch = matchResult.confidence > 0.7;
    const hasAnyMatch = matchResult.confidence > 0.2;
    
    // Auto if:
    // 1. Pristine Case: Very safe pattern + any match + high total score
    // 2. Strong Confidence: Any auto pattern + strong hook match + high score
    const isPristine = isVerySafePattern && hasAnyMatch && finalScore >= 65;
    const isHighConfidence = isAutoPattern && isStrongMatch && finalScore >= 70;

    // Safety Gate: If dangerous usage detected, force higher bar
    let shouldAuto = (isPristine || isHighConfidence) && !propRisk.isHighRisk;
    if (usageProfile.isDangerous) {
        shouldAuto = isAutoPattern && isStrongMatch && finalScore >= 90;
    }

    if (shouldAuto) {
      // AUTO: All green or strongly patterned
      const binding: Binding = {
        mockName: mock.name,
        hookName: prediction?.choice || matchResult.bestHook,
        confidence: finalScore / 100,
        actionType: this.inferActionType(mock, usages),
        strategy: patternResult.strategy,
        transformer: patternResult.transformer,
        transformationExpression: usages[0]?.transformationExpression,
        loadingStrategy: projectContext.detectedStyle.includes('Skeleton') ? 'early-return-skeleton' : 'none',
        errorStrategy: 'early-return-error',
        inferredInput: inferredInput?.expression,
        mutationTemplate: mutationTemplate
      };

      return {
        type: 'auto',
        confidence: finalScore / 100,
        reasoning: chain,
        binding
      };
    }

    if (finalScore >= 15 || projectContext.protocol === 'trpc') {
      // HUMAN-IN-LOOP: 
      // For tRPC, we almost ALWAYS offer a human option instead of a TODO,
      // unless it's a critical safety violation.
      const options = this.optionsGenerator.generate(
        mock, 
        usages, 
        patternResult.humanPattern || patternResult.patternName || 'generic', 
        projectContext, 
        matchResult
      );
      
      return {
        type: 'human',
        confidence: finalScore / 100,
        reasoning: chain,
        options,
        binding: {
            mockName: mock.name,
            hookName: matchResult.bestHook,
            confidence: finalScore / 100,
            actionType: this.inferActionType(mock, usages),
            strategy: patternResult.strategy || 'default',
            inferredInput: inferredInput?.expression
        }
      };
    }

    // TODO: Genuine uncertainty or hard pattern
    // LLM Fallback (only for uncertain cases, elevates to HUMAN)
    if (normalizedScore < 50) {
      const fallback = new OllamaFallback(projectContext.llm);
      const llmPrediction = await fallback.predictHook(mock.name, mock.snippet, hookNames, projectContext);
      
      if (llmPrediction && llmPrediction.confidence > 0.6) {
          chain.push({
              layer: 'semantic',
              score: 20,
              maxScore: 20,
              explanation: `LLM Fallback suggested ${llmPrediction.hookName}: ${llmPrediction.reasoning}`,
              details: { llmPrediction }
          });
          
          return {
            type: 'human',
            confidence: llmPrediction.confidence,
            reasoning: chain,
            options: this.optionsGenerator.generate(
                mock, 
                usages, 
                patternResult.patternName || 'generic', 
                projectContext, 
                { ...matchResult, bestHook: llmPrediction.hookName } as any
            ),
            binding: {
                mockName: mock.name,
                hookName: llmPrediction.hookName,
                confidence: llmPrediction.confidence,
                actionType: this.inferActionType(mock, usages),
                strategy: patternResult.strategy || 'default'
            }
          };
      }
    }

    const todoContext = this.todoGenerator.generate(mock, usages, patternResult, matchResult);

    return {
      type: 'todo',
      confidence: normalizedScore / 100,
      reasoning: chain,
      todoContext
    };
  }

  private inferActionType(mock: MockFinding, usages: Usage[]): 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' {
    if (mock.type === 'action_mock') {
      if (mock.name.match(/delete|remove/i)) return 'DELETE';
      if (mock.name.match(/add|create|post/i)) return 'CREATE';
      if (mock.name.match(/update|edit|put|patch/i)) return 'UPDATE';
    }
    return 'READ';
  }
}
