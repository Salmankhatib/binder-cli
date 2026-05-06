import { Project, SyntaxKind, Node, CallExpression } from 'ts-morph';
import { logger } from '../utils/logger.js';

export interface MutationTemplate {
  router: string;
  invalidates: string[];
  hasOnSuccess: boolean;
  hasOnError: boolean;
  retryCount?: number;
}

/**
 * Phase 4.1: Mutation Pattern Discovery
 * Scans the project for existing useMutation calls to learn project-specific invalidation patterns.
 */
export class MutationAnalyzer {
  private templates: Map<string, MutationTemplate> = new Map();

  async analyzeProject(project: Project): Promise<Map<string, MutationTemplate>> {
    logger.startSpinner("Analyzing mutation patterns in project...");
    
    const sourceFiles = project.getSourceFiles();
    for (const file of sourceFiles) {
      if (file.getFilePath().includes('node_modules')) continue;

      const mutations = file.getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter(c => {
          const text = c.getExpression().getText();
          return text.includes('useMutation');
        });

      for (const mutation of mutations) {
        this.extractTemplate(mutation);
      }
    }

    logger.stopSpinner(true, `Discovered ${this.templates.size} mutation templates.`);
    return this.templates;
  }

  private extractTemplate(mutation: CallExpression) {
    const exprText = mutation.getExpression().getText();
    
    // tRPC style: trpc.user.create.useMutation(...)
    // REST style: useMutation({ ... }) or custom useUpdateUser({ ... })
    let router = 'global';
    if (exprText.startsWith('trpc.')) {
        const parts = exprText.split('.');
        router = parts.slice(1, -1).join('.'); // "user.create" -> "user"
    } else if (exprText.startsWith('use')) {
        // Simple heuristic for REST: use the hook name or 'global'
        router = exprText.replace('use', '').replace('Mutation', '').toLowerCase() || 'global';
    }

    const args = mutation.getArguments();
    if (args.length === 0) return;

    // In RQ, options can be the 1st or 2nd arg
    const options = args.find(a => Node.isObjectLiteralExpression(a)) as any;
    if (!options) return;

    const invalidates: string[] = [];
    
    // Look for onSuccess and find invalidateCalls (both tRPC and RQ style)
    const onSuccess = options.getProperty('onSuccess');
    if (onSuccess && Node.isPropertyAssignment(onSuccess)) {
        const init = onSuccess.getInitializer();
        if (init) {
            const text = init.getText();
            
            // 1. Trace tRPC style: utils.user.list.invalidate()
            const trpcInvalidates = text.match(/utils\.([\w\.]+)\.invalidate/g);
            if (trpcInvalidates) {
                trpcInvalidates.forEach(match => {
                    invalidates.push(match.replace('utils.', '').replace('.invalidate', ''));
                });
            }

            // 2. Trace standard RQ style: queryClient.invalidateQueries({ queryKey: ['users'] })
            const rqInvalidates = text.match(/invalidateQueries\(\{.*?queryKey:\s*\[['"]([\w-]+)['"]\]/s);
            if (rqInvalidates && rqInvalidates[1]) {
                invalidates.push(rqInvalidates[1]);
            }
        }
    }

    const template: MutationTemplate = {
      router,
      invalidates: Array.from(new Set(invalidates)),
      hasOnSuccess: !!onSuccess,
      hasOnError: !!options.getProperty('onError'),
    };

    const existing = this.templates.get(router);
    if (existing) {
        // Merge invalidates
        existing.invalidates = Array.from(new Set([...existing.invalidates, ...template.invalidates]));
    } else {
        this.templates.set(router, template);
    }
  }

  getTemplateForRouter(router: string): MutationTemplate | undefined {
    return this.templates.get(router);
  }
}
