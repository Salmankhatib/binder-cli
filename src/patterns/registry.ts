// src/patterns/registry.ts
import { MockFinding, Usage } from '../engine/types.js';
import { AutoPattern } from './auto/base.js';
import { HumanPattern } from './human/base.js';
import { DirectAssignmentPattern } from './auto/directAssignment.js';
import { SimpleMapPattern } from './auto/simpleMap.js';
import { InlineUseQueryPattern } from './auto/inlineUseQuery.js';
import { PropPassingPattern } from './auto/propPassing.js';
import { DeterministicTransformsPattern } from './auto/deterministicTransforms.js';
import { DestructuredAssignmentPattern } from './auto/destructuredAssignment.js';
import { ArrayLiteralSpreadPattern } from './auto/arrayLiteralSpread.js';
import { ObjectSpreadPurePattern } from './auto/objectSpreadPure.js';
import { TernaryPurePattern } from './auto/ternaryPure.js';
import { LengthCheckPattern } from './auto/lengthCheck.js';
import { IncludesCheckPattern } from './auto/includesCheck.js';
import { EverySomePattern } from './auto/everySome.js';
import { ReduceAccumulatorPattern } from './auto/reduceAccumulator.js';
import { UseMemoDependencyPattern } from './auto/useMemoDependency.js';
import { GuardEarlyReturnPattern } from './auto/guardEarlyReturn.js';
import { FormDefaultsPattern } from './auto/formDefaults.js';
import { SlicePaginationPattern } from './auto/slicePagination.js';
import { FindByIdPattern } from './auto/findById.js';
import { StorybookArgsPattern } from './auto/storybookArgs.js';
import { TestMockProviderPattern } from './auto/testMockProvider.js';
import { ReturnDirectPattern } from './auto/returnDirect.js';
import { ComputedChainPattern } from './auto/computedChain.js';
import { ChartDataTransformPattern } from './auto/chartDataTransform.js';
import { EffectInitOnlyPattern } from './auto/effectInitOnly.js';
import { UtilityTransformPattern } from './auto/utilityTransform.js';
import { ConditionalStaticPattern } from './auto/conditionalStatic.js';
import { JsxPropDirectPattern } from './auto/jsxPropDirect.js';
import { ErrorFallbackPattern } from './auto/errorFallback.js';
import { LoadingFallbackPattern } from './auto/loadingFallback.js';
import { GroupByStaticPattern } from './auto/groupByStatic.js';
import { UniqueByKeyPattern } from './auto/uniqueByKey.js';
import { TableColumnMapPattern } from './auto/tableColumnMap.js';
import { UseCallbackParamPattern } from './auto/useCallbackParam.js';
import { MergeHooksPattern } from './auto/mergeHooks.js';
import { PropToHookPattern } from './auto/propToHook.js';
import { UseStateMockInitPattern } from './auto/useStateMockInit.js';
import { AlreadyGuardedPattern } from './auto/alreadyGuarded.js';
import { SafeSpreadPropsPattern } from './auto/safeSpreadProps.js';
import { ArrayAtIndexPattern } from './auto/arrayAtIndex.js';
import { OptionalChainPattern } from './auto/optionalChain.js';
import { MutationSetterPattern } from './auto/mutationSetter.js';
import { SubscriptionRefreshPattern } from './auto/subscriptionRefresh.js';
import { DependencyArrayPattern } from './auto/dependencyArray.js';
import { DefaultParameterPattern } from './auto/defaultParameter.js';
import { ComputedDerivativePattern } from './auto/computedDerivative.js';
import { SimpleFilterPattern } from './auto/simpleFilter.js';
import { SimpleSortPattern } from './auto/simpleSort.js';

import { PaginationStrategyPattern } from './human/paginationStrategy.js';
import { SortStrategyPattern } from './human/sortStrategy.js';
import { FilterStrategyPattern } from './human/filterStrategy.js';
import { MutationTimingPattern } from './human/mutationTiming.js';
import { PropDrillShallowPattern } from './human/propDrillShallow.js';
import { SearchStrategyPattern } from './human/searchStrategy.js';
import { RealtimeVsFetchPattern } from './human/realtimeVsFetch.js';
import { CacheInvalidationPattern } from './human/cacheInvalidation.js';
import { MultiSourceMergePattern } from './human/multiSourceMerge.js';
import { DerivedAsyncPattern } from './human/derivedAsync.js';
import { ConditionalFeatureFlagPattern } from './human/conditionalFeatureFlag.js';
import { AuthorizationEmbeddedPattern } from './human/authorizationEmbedded.js';
import { MockWithLogicPattern } from './human/mockWithLogic.js';

import { TodoPattern } from './todo/base.js';
import { SideEffectMockPattern } from './todo/sideEffectMock.js';
import { PerformanceCriticalPattern } from './todo/performanceCritical.js';
import { RecursionDetectionPattern } from './todo/recursionDetection.js';
import { ClassDetectionPattern } from './todo/classDetection.js';

export interface PatternMatch {
  patternName: string;
  category: 'auto' | 'human' | 'todo';
  confidence: number;
  strategy: string;
  transformer?: string;
  usage: Usage;
}

export class PatternRegistry {
  private autoPatterns: AutoPattern[];
  private humanPatterns: HumanPattern[];
  private todoPatterns: TodoPattern[];

  constructor() {
    this.autoPatterns = [
      new DirectAssignmentPattern(),
      new SimpleMapPattern(),
      new InlineUseQueryPattern(),
      new DeterministicTransformsPattern(),
      new DestructuredAssignmentPattern(),
      new ArrayLiteralSpreadPattern(),
      new ObjectSpreadPurePattern(),
      new TernaryPurePattern(),
      new LengthCheckPattern(),
      new IncludesCheckPattern(),
      new EverySomePattern(),
      new GuardEarlyReturnPattern(),
      new FormDefaultsPattern(),
      new FindByIdPattern(),
      new StorybookArgsPattern(),
      new TestMockProviderPattern(),
      new ReturnDirectPattern(),
      new ChartDataTransformPattern(),
      new EffectInitOnlyPattern(),
      new UtilityTransformPattern(),
      new ConditionalStaticPattern(),
      new JsxPropDirectPattern(),
      new ErrorFallbackPattern(),
      new LoadingFallbackPattern(),
      new GroupByStaticPattern(),
      new UniqueByKeyPattern(),
      new TableColumnMapPattern(),
      new MergeHooksPattern(),
      new PropToHookPattern(),
      new AlreadyGuardedPattern(),
      new SafeSpreadPropsPattern(),
      new ArrayAtIndexPattern(),
      new OptionalChainPattern(),
      new MutationSetterPattern(),
      new SubscriptionRefreshPattern(),
      new UseStateMockInitPattern(),
    ];

    this.humanPatterns = [
      new PaginationStrategyPattern(),
      new SortStrategyPattern(),
      new FilterStrategyPattern(),
      new MutationTimingPattern(),
      new PropDrillShallowPattern(),
      new SearchStrategyPattern(),
      new RealtimeVsFetchPattern(),
      new CacheInvalidationPattern(),
      new MultiSourceMergePattern(),
      new DerivedAsyncPattern(),
      new ConditionalFeatureFlagPattern(),
      new AuthorizationEmbeddedPattern(),
      new MockWithLogicPattern(),
      new SlicePaginationPattern() as any,
      new SimpleFilterPattern() as any,
      new ReduceAccumulatorPattern() as any,
      new SimpleSortPattern() as any,
      new ComputedChainPattern() as any,
      new DefaultParameterPattern() as any,
      new ComputedDerivativePattern() as any,
      new PropPassingPattern() as any,
      new UseMemoDependencyPattern() as any,
      new UseCallbackParamPattern() as any,
    ];

    this.todoPatterns = [
      new SideEffectMockPattern(),
      new PerformanceCriticalPattern(),
      new RecursionDetectionPattern(),
      new ClassDetectionPattern(),
    ];
  }

  findMatches(mock: MockFinding, usages: Usage[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const usage of usages) {
      // 1. Check TODO patterns first (Highest priority)
      for (const pattern of this.todoPatterns) {
        try {
            const result = pattern.test(mock, usage);
            if (result.matches) {
              matches.push({
                patternName: pattern.name,
                category: 'todo',
                confidence: result.confidence,
                strategy: 'todo',
                usage
              });
            }
        } catch (e: any) {}
      }

      // 2. Check auto patterns
      for (const pattern of this.autoPatterns) {
        try {
            const result = pattern.test(mock, usage);
            if (result.matches) {
              matches.push({
                patternName: pattern.name,
                category: 'auto',
                confidence: result.confidence,
                strategy: result.strategy,
                transformer: result.transformer,
                usage
              });
            }
        } catch (e: any) {
            // console.error(`Error in pattern ${pattern.name}: ${e.message}`);
        }
      }

      // Check human patterns
      for (const pattern of this.humanPatterns) {
        try {
            const result = pattern.test(mock, usage);
            if (result.matches) {
              matches.push({
                patternName: pattern.name,
                category: 'human',
                confidence: result.confidence,
                strategy: 'human-decision',
                usage
              });
            }
        } catch (e: any) {
            // console.error(`Error in pattern ${pattern.name}: ${e.message}`);
        }
      }
    }

    return matches;
  }
}
