import { Project } from 'ts-morph';
import { collectAPICalls, APICall } from './apiCallCollector.js';
import { relative } from 'path';

export interface EndpointUsage {
  endpoint: string;
  consumers: {
    file: string;
    line: number;
    componentName?: string;
  }[];
  fidelityScore: number; // 0-100
}

/**
 * UsageTracker correlates frontend code consumers with backend API endpoints.
 */
export class UsageTracker {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  async trackUsage(rootDir: string): Promise<Record<string, EndpointUsage>> {
    const calls = await collectAPICalls(rootDir);
    const usageMap: Record<string, EndpointUsage> = {};

    for (const call of calls) {
      // Heuristic: map hook name back to a likely endpoint if not explicitly provided
      // In a real enterprise app, we'd use the mapping from the generated hooks.
      const endpoint = this.deriveEndpointFromHook(call.hookName);
      
      if (!usageMap[endpoint]) {
        usageMap[endpoint] = {
          endpoint,
          consumers: [],
          fidelityScore: 100 // Default, will be calculated later
        };
      }

      usageMap[endpoint].consumers.push({
        file: relative(process.cwd(), call.file),
        line: call.line,
        componentName: this.getComponentName(call.file)
      });
    }

    return usageMap;
  }

  private deriveEndpointFromHook(hookName: string): string {
    // e.g. useGetUsers -> /api/users
    const name = hookName.replace(/^use(Get|Post|Put|Delete)?/, '');
    return `/api/${name.toLowerCase()}`;
  }

  private getComponentName(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    const fileName = parts[parts.length - 1];
    return fileName.split('.')[0];
  }
}
