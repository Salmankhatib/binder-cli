// src/human/optionsGenerator.ts
import { MockFinding, Usage, ProjectContext, HumanOption } from '../engine/types.js';
import { DiffPreviewGenerator } from './consequencePreview.js';

export class OptionsGenerator {
  private diffGenerator = new DiffPreviewGenerator();

  generate(
    mock: MockFinding,
    usages: Usage[],
    patternName: string,
    projectContext: ProjectContext,
    matchResult: any
  ): HumanOption[] {
    const needsInput = matchResult.needsInput || false;

    if (needsInput && projectContext.protocol === 'trpc') {
        return this.generateTrpcInputOptions(mock, usages, projectContext, matchResult);
    }

    switch (patternName) {
      case 'pagination-strategy':
        return this.generatePaginationOptions(mock, usages, projectContext, matchResult);
      case 'sort-strategy':
        return this.generateSortStrategyOptions(mock, usages, projectContext, matchResult);
      case 'filter-strategy':
        return this.generateFilterStrategyOptions(mock, usages, projectContext, matchResult);
      case 'search-strategy':
        return this.generateSearchStrategyOptions(mock, usages, projectContext, matchResult);
      case 'mutation-timing':
        return this.generateMutationTimingOptions(mock, usages, projectContext, matchResult);
      case 'prop-drill-shallow':
        return this.generatePropDrillOptions(mock, usages, projectContext, matchResult, 'shallow');
      default:
        return this.generateGenericOptions(mock, usages, projectContext, matchResult);
    }
  }

  private generateTrpcInputOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any): HumanOption[] {
    return [
      {
        id: 'manual-input',
        label: 'Manual Input Mapping',
        description: `I matched "${match.bestHook}", but I can't find a matching variable for its input.`,
        consequence: {
          codeDiff: `+ // TODO: Manually provide input for ${match.bestHook}\n+ const { data } = trpc.${match.bestHook}.useQuery({ /* input here */ });`,
          typeCheckResult: 'unknown',
          performanceImpact: 'None.',
          architecturalChange: 'Manual wiring required.',
          filesModified: [context.filePath]
        },
        confidence: 0.5,
        effortEstimate: 'low',
        riskLevel: 'safe'
      }
    ];
  }

  private generatePaginationOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any): HumanOption[] {
    const hookName = match.bestHook;
    return [
      {
        id: 'client-side',
        label: 'Client-side pagination',
        description: 'Fetch all data, paginate in useMemo. Simple, but loads full dataset into memory.',
        consequence: {
          codeDiff: this.diffGenerator.generateClientPagination(mock, usages, hookName),
          typeCheckResult: 'pass',
          performanceImpact: 'O(n) memory.',
          architecturalChange: 'None.',
          filesModified: [context.filePath]
        },
        confidence: 0.85,
        effortEstimate: 'low',
        riskLevel: 'safe'
      },
      {
        id: 'server-side',
        label: 'Server-side pagination',
        description: 'Add page/size params to API call. Requires backend support.',
        consequence: {
          codeDiff: this.diffGenerator.generateServerPagination(mock, usages, hookName),
          typeCheckResult: 'unknown',
          performanceImpact: 'Scalable.',
          architecturalChange: 'Add pagination state.',
          filesModified: [context.filePath]
        },
        confidence: 0.70,
        effortEstimate: 'medium',
        riskLevel: 'caution'
      }
    ];
  }

  private generateSortStrategyOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any): HumanOption[] {
    return [
      {
        id: 'client-sort',
        label: 'Client-side Sort',
        description: 'Sort data in useMemo using local state.',
        consequence: {
          codeDiff: this.diffGenerator.generateClientSort(mock, usages, match.bestHook),
          typeCheckResult: 'pass',
          performanceImpact: 'Minimal for small sets.',
          architecturalChange: 'None.',
          filesModified: [context.filePath]
        },
        confidence: 0.9,
        effortEstimate: 'low',
        riskLevel: 'safe'
      },
      {
        id: 'server-sort',
        label: 'Server-side Sort',
        description: 'Pass sort field/order to API hook.',
        consequence: {
          codeDiff: this.diffGenerator.generateServerSort(mock, usages, match.bestHook),
          typeCheckResult: 'unknown',
          performanceImpact: 'Optimal.',
          architecturalChange: 'Hook param change.',
          filesModified: [context.filePath]
        },
        confidence: 0.8,
        effortEstimate: 'medium',
        riskLevel: 'safe'
      }
    ];
  }

  private generateFilterStrategyOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any): HumanOption[] {
    return [
      {
        id: 'client-filter',
        label: 'Client-side Filter',
        description: 'Filter data locally in useMemo.',
        consequence: {
          codeDiff: this.diffGenerator.generateClientFilter(mock, usages, match.bestHook),
          typeCheckResult: 'pass',
          performanceImpact: 'O(n).',
          architecturalChange: 'None.',
          filesModified: [context.filePath]
        },
        confidence: 0.9,
        effortEstimate: 'low',
        riskLevel: 'safe'
      }
    ];
  }

  private generateSearchStrategyOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any): HumanOption[] {
    return [
      {
        id: 'debounced-search',
        label: 'Debounced Search (Server)',
        description: 'Debounce search term and fetch from API.',
        consequence: {
          codeDiff: this.diffGenerator.generateDebouncedSearch(mock, usages, match.bestHook),
          typeCheckResult: 'pass',
          performanceImpact: 'Reduces API noise.',
          architecturalChange: 'Add useDebounce.',
          filesModified: [context.filePath]
        },
        confidence: 0.8,
        effortEstimate: 'medium',
        riskLevel: 'safe'
      }
    ];
  }

  private generateMutationTimingOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any): HumanOption[] {
    return [
      {
        id: 'pessimistic',
        label: 'Pessimistic Update',
        description: 'Wait for server response before updating UI.',
        consequence: {
          codeDiff: this.diffGenerator.generatePessimisticMutation(mock, usages, match.bestHook),
          typeCheckResult: 'pass',
          performanceImpact: 'Safe, simple UX.',
          architecturalChange: 'None.',
          filesModified: [context.filePath]
        },
        confidence: 0.95,
        effortEstimate: 'low',
        riskLevel: 'safe'
      },
      {
        id: 'optimistic',
        label: 'Optimistic Update',
        description: 'Update UI immediately, rollback on error.',
        consequence: {
          codeDiff: this.diffGenerator.generateOptimisticMutation(mock, usages, match.bestHook),
          typeCheckResult: 'pass',
          performanceImpact: 'Instant feel.',
          architecturalChange: 'Complex rollback logic.',
          filesModified: [context.filePath]
        },
        confidence: 0.75,
        effortEstimate: 'high',
        riskLevel: 'caution'
      }
    ];
  }

  private generatePropDrillOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any, depth: string): HumanOption[] {
    return [
      {
        id: 'keep-props',
        label: 'Pass via Props (Keep Signature)',
        description: 'Keep existing prop-drilling, just swap the source.',
        consequence: {
          codeDiff: this.diffGenerator.generateKeepProps(mock, usages, match.bestHook),
          typeCheckResult: 'pass',
          performanceImpact: 'None.',
          architecturalChange: 'Minimal.',
          filesModified: [context.filePath]
        },
        confidence: 0.9,
        effortEstimate: 'low',
        riskLevel: 'safe'
      },
      {
        id: 'inline-hooks',
        label: 'Call Hook Locally (Clean Props)',
        description: 'Remove props, call the hook in the child component.',
        consequence: {
          codeDiff: this.diffGenerator.generateInlineHooks(mock, usages, match.bestHook, depth),
          typeCheckResult: 'pass',
          performanceImpact: 'Reduces coupling.',
          architecturalChange: 'Refactor signatures.',
          filesModified: [context.filePath]
        },
        confidence: 0.8,
        effortEstimate: 'medium',
        riskLevel: 'safe'
      }
    ];
  }

  private generateGenericOptions(mock: MockFinding, usages: Usage[], context: ProjectContext, match: any): HumanOption[] {
    return [
      {
        id: 'auto-anyway',
        label: 'Auto-convert with best guess',
        description: 'Apply standard rewrite. May need manual adjustment.',
        consequence: {
          codeDiff: this.diffGenerator.generateDefault(mock, usages, match.bestHook),
          typeCheckResult: 'unknown',
          performanceImpact: 'Unknown',
          architecturalChange: 'Minimal',
          filesModified: [context.filePath]
        },
        confidence: 0.60,
        effortEstimate: 'low',
        riskLevel: 'caution'
      }
    ];
  }
}
