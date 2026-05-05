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
import { analyzeUsage } from '../analyze/usageAnalyzer.js';
import { analyzePropDrillingRisk } from '../analyze/propAnalyzer.js';

export class DecisionEngine {
  private patternScorer: PatternScorer;
  private matchScorer: MatchScorer;
  private typeScorer: TypeScorer;
  private contextScorer: ContextScorer;
  private patternRegistry: PatternRegistry;
  private optionsGenerator: OptionsGenerator;
  private todoGenerator: TodoGenerator;
  private accelerator: LearningAccelerator;

  constructor() {
    this.patternScorer = new PatternScorer();
    this.matchScorer = new MatchScorer();
    this.typeScorer = new TypeScorer();
    this.contextScorer = new ContextScorer();
    this.patternRegistry = new PatternRegistry();
    this.optionsGenerator = new OptionsGenerator();
    this.todoGenerator = new TodoGenerator();
    this.accelerator = new LearningAccelerator();
  }

  async decide(
    mock: MockFinding,
    usages: Usage[],
    projectContext: ProjectContext,
    hookNames: string[],
    apiContent: string,
    drills: any[] = []
  ): Promise<Decision> {
    const chain: ReasoningChain[] = [];

    // PRIORITY 1: Usage Pattern Analysis
    const usageProfile = analyzeUsage(usages as any);
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
        score: propRisk.isHighRisk ? 2 : 5, 
        maxScore: 10,
        explanation: propRisk.explanation,
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
    const matchResult = await this.matchScorer.score(mock, hookNames, apiContent, projectContext, usageProfile);
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
    
    // PRIORITY 5: Penalty for Prop Drilling
    let contextScore = contextResult.score;
    if (drills.length > 0) {
        contextScore -= 5; // Penalty
        chain.push({
            layer: 'project-context',
            score: -5,
            maxScore: 0,
            explanation: `Mock is prop-drilled into ${drills.length} components. Auto-binding may break the tree.`,
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
    // Determine decision type
    if (patternResult.category === 'todo') {
      return {
        type: 'todo',
        confidence: finalScore / 100,
        reasoning: chain,
        todoContext: this.todoGenerator.generate(mock, usages, patternResult, matchResult)
      };
    }

    // v1.0.0 TARGET OPTIMIZATION: 
    const isAutoPattern = patternResult.isAuto;
    const isVerySafePattern = isAutoPattern && (patternResult.patternName === 'direct-assignment' || patternResult.patternName === 'simple-map' || patternResult.patternName === 'jsx-prop-direct');
    const hasMatch = matchResult.confidence > 0.15;
    
    // Auto if:
    // 1. High total score (>= 55)
    // 2. Very safe pattern + any match
    // 3. Strong Auto pattern + any match (>= 30 pattern score)
    // 4. NOT dangerous (no useState-init, useEffect-dep, prop-pass etc)
    const shouldAuto = isAutoPattern && !usageProfile.isDangerous && !propRisk.isHighRisk && (
        finalScore >= 55 || 
        (isVerySafePattern && hasMatch) ||
        (patternResult.score >= 30 && hasMatch)
    );

    if (shouldAuto) {
      // AUTO: All green or strongly patterned
      const binding: Binding = {
        mockName: mock.name,
        hookName: prediction?.choice || matchResult.bestHook,
        confidence: finalScore / 100,
        actionType: this.inferActionType(mock, usages),
        strategy: patternResult.strategy,
        transformer: patternResult.transformer,
        loadingStrategy: projectContext.detectedStyle.includes('Skeleton') ? 'early-return-skeleton' : 'none',
        errorStrategy: 'early-return-error'
      };

      return {
        type: 'auto',
        confidence: finalScore / 100,
        reasoning: chain,
        binding
      };
    }

    if (finalScore >= 25) {
      // HUMAN-IN-LOOP
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
            strategy: patternResult.strategy || 'default'
        }
      };
    }

    // TODO: Genuine uncertainty or hard pattern
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
