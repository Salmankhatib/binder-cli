// src/adapters/trpc.adapter.ts
import { DataLibraryAdapter } from './adapter.interface.js';

export class TrpcAdapter implements DataLibraryAdapter {
  name = 'trpc';
  dataProperty = 'data';
  loadingProperty = 'isLoading';
  errorProperty = 'isError';

  constructor(private trpcExportName: string = 'trpc') {}

  generateQueryCall(hookName: string, input?: string): string {
    const isMutation = hookName.includes('create') || hookName.includes('update') || hookName.includes('delete') || hookName.includes('remove') || hookName.includes('post');
    const inputStr = input ? `(${input})` : '()';
    
    if (isMutation) {
        return `${this.trpcExportName}.${hookName}.useMutation()`;
    }
    
    return `${this.trpcExportName}.${hookName}.useQuery${inputStr}`;
  }

  generateMutationCall(hookName: string, template?: any): string {
    let options = '';
    if (template && template.invalidates.length > 0) {
        const utils = 'utils'; // Placeholder for trpc.useUtils()
        const invalidates = template.invalidates.map((i: string) => `${utils}.${i}.invalidate()`).join('; ');
        options = `({
      onSuccess: () => {
        ${invalidates}
      }
    })`;
    }
    return `${this.trpcExportName}.${hookName}.useMutation${options}`;
  }

  generateMemoCall(variable: string, transformer: string): string {
    return `useMemo(() => ${variable}?.${transformer}, [${variable}])`;
  }
}
