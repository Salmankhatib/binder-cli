import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../../utils/logger.js';

export interface IndexData {
    files: Record<string, {
        hash: string;
        hooks: string[];
        symbols: string[];
    }>;
    hookUsageFrequency: Record<string, number>;
}

export class BinderIndex {
    private static instance: BinderIndex;
    private data: IndexData;
    private dbPath: string;

    private constructor() {
        const binderDir = resolve(process.cwd(), '.binder');
        if (!existsSync(binderDir)) mkdirSync(binderDir, { recursive: true });
        
        this.dbPath = resolve(binderDir, 'index.db.json');
        this.data = this.load();
    }

    public static getInstance(): BinderIndex {
        if (!BinderIndex.instance) {
            BinderIndex.instance = new BinderIndex();
        }
        return BinderIndex.instance;
    }

    private load(): IndexData {
        if (!existsSync(this.dbPath)) {
            return { files: {}, hookUsageFrequency: {} };
        }
        try {
            return JSON.parse(readFileSync(this.dbPath, 'utf-8'));
        } catch (e) {
            logger.debug('Failed to load index, creating fresh one.');
            return { files: {}, hookUsageFrequency: {} };
        }
    }

    public save() {
        try {
            writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
        } catch (e: any) {
            logger.error(`Failed to save index: ${e.message}`);
        }
    }

    public getFileData(path: string) {
        return this.data.files[path];
    }

    public setFileData(path: string, hash: string, hooks: string[], symbols: string[]) {
        // Decrement old frequencies
        const oldEntry = this.data.files[path];
        if (oldEntry) {
            oldEntry.hooks.forEach(h => {
                if (this.data.hookUsageFrequency[h]) {
                    this.data.hookUsageFrequency[h]--;
                    if (this.data.hookUsageFrequency[h] <= 0) delete this.data.hookUsageFrequency[h];
                }
            });
        }

        // Add new entry
        this.data.files[path] = { hash, hooks, symbols };

        // Increment new frequencies
        hooks.forEach(h => {
            this.data.hookUsageFrequency[h] = (this.data.hookUsageFrequency[h] || 0) + 1;
        });
    }

    public getHookFrequency(name: string): number {
        return this.data.hookUsageFrequency[name] || 0;
    }

    public getAllHookFrequencies(): Record<string, number> {
        return this.data.hookUsageFrequency;
    }

    public getFilesCount(): number {
        return Object.keys(this.data.files).length;
    }
}
