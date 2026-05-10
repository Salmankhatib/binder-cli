import { Project, SourceFile } from 'ts-morph';
import { DecisionEngine } from '../engine/decisionEngine.js';
import { findAllUsages } from '../analysis/usageFinder.js';
import { Binding } from '../common/types.js';
import { ProjectContext } from '../engine/types.js';
import { MockFinding } from '../engine/types.js';

export interface BindingPlan {
  bindings: Binding[];
  importsToRemove: string[];
  importsToAdd: { name: string; path: string; isDefault?: boolean }[];
}

/**
 * createBindingPlan generates a full refactoring plan for a single file.
 */

export async function createBindingPlan(
  mocks: MockFinding[],
  _unused: any[],
  filePath: string,
  config: any,
  apiContent: string,
  projectMap: any
): Promise<BindingPlan> {
  const project = new Project();
  project.addSourceFilesAtPaths(projectMap.tree);
  const sourceFile = project.getSourceFile(filePath);
  
  if (!sourceFile) {
    return { bindings: [], importsToRemove: [], importsToAdd: [] };
  }

  const decisionEngine = new DecisionEngine();
  const bindings: Binding[] = [];
  const hooksToImport = new Set<string>();

  const projectContext: ProjectContext = {
    protocol: config.protocol || 'rest',
    detectedStyle: 'React, React Query',
    filePath: filePath,
    folderContext: '',
    imports: [],
    dependencies: [],
    tsConfigPath: null
  } as any;

  // Mock finding the hook names from the apiContent
  const hookNames = extractHookNames(apiContent);

  for (const mock of mocks) {
    const usages = findAllUsages(mock.name, sourceFile);
    const decision = await decisionEngine.decide(
      mock,
      usages as any,
      projectContext as any,
      hookNames,
      apiContent
    );

    if ((decision.type === 'auto' || decision.type === 'human') && decision.binding) {
      bindings.push(decision.binding);
      hooksToImport.add(decision.binding.hookName);
    }
  }

  const importsToAdd = Array.from(hooksToImport).map(hook => ({
    name: hook,
    path: '@/generated/api' // Heuristic for tests
  }));

  return {
    bindings,
    importsToRemove: mocks.map(m => m.name),
    importsToAdd
  };
}

function extractHookNames(content: string): string[] {
  const matches = [...content.matchAll(/export\s+(?:const|function)\s+(use\w+)/g)];
  return matches.map(m => m[1]);
}
