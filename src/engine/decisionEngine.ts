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

    // Add drill info to reasoning if present
    if (drills.length > 0) {
      chain.push({
        layer: 'project-context',
        score: 10,
        maxScore: 10,
        explanation: `Prop drilling detected across ${drills.length} levels.`,
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
    const matchResult = await this.matchScorer.score(mock, hookNames, apiContent, projectContext);
    chain.push({
      layer: 'match',
      score: matchResult.score,
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
    chain.push({
      layer: 'project-context',
      score: contextResult.score,
      maxScore: 10,
      explanation: contextResult.explanation,
      details: { folderMatch: contextResult.folderMatch, styleMatch: contextResult.styleMatch }
    });

    const totalScore = chain.reduce((sum, c) => sum + c.score, 0);
    const maxScore = chain.reduce((sum, c) => sum + c.maxScore, 0);
    const normalizedScore = (totalScore / maxScore) * 100;

    // Layer 5: Learning (Boost if we've seen this exact signature before)
    const prediction = this.accelerator.predict({
      mockName: mock.name,
      patternName: patternResult.patternName || '',
      structuralSignature: usages[0]?.structuralSignature || '',
      projectContext: projectContext.filePath
    });

    let finalScore = normalizedScore;
    if (prediction) {
      finalScore += 10;
      chain.push({
        layer: 'semantic', 
        score: 10,
        maxScore: 10,
        explanation: `Learned pattern detected: ${prediction.choice}`,
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
    const shouldAuto = isAutoPattern && (
        finalScore >= 55 || 
        (isVerySafePattern && hasMatch) ||
        (patternResult.score >= 30 && hasMatch)
    );

    if (shouldAuto) {
      // AUTO: All green or strongly patterned
      const binding: Binding = {
        mockName: mock.name,
        hookName: matchResult.bestHook,
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
