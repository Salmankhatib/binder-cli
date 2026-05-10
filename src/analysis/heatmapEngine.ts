import { Project } from 'ts-morph';
import { SchemaDiffer } from './schemaDiffer.js';
import { collectAPICalls } from './apiCallCollector.js';
import { readFileSync } from 'fs';
import { join, dirname, relative } from 'path';

export interface HeatmapNode {
  path: string;
  score: number; // 0 (healthy) to 100 (critical drift)
  type: 'file' | 'directory';
}

/**
 * HeatmapEngine calculates "Drift Density" to identify technical debt hotspots.
 */
export class HeatmapEngine {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  async calculateHeatmap(): Promise<HeatmapNode[]> {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'binder.config.json'), 'utf-8'));
    const schema = JSON.parse(readFileSync(join(process.cwd(), config.backend.schemaPath || 'openapi.json'), 'utf-8'));
    
    const differ = new SchemaDiffer();
    const calls = await collectAPICalls(join(process.cwd(), 'src'));
    const drift = differ.detectRenames(schema, schema); // Placeholder for actual remote comparison

    const fileScores: Record<string, number> = {};

    // Calculate score per file based on drift count and usage density
    for (const call of calls) {
        const relPath = relative(process.cwd(), call.file);
        const hasDrift = drift.some(d => d.hookName === call.hookName);
        
        fileScores[relPath] = (fileScores[relPath] || 0) + (hasDrift ? 25 : 5);
        if (fileScores[relPath] > 100) fileScores[relPath] = 100;
    }

    return Object.entries(fileScores).map(([path, score]) => ({
        path,
        score,
        type: 'file'
    }));
  }
}
