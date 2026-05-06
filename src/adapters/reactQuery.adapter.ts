// src/adapters/reactQuery.adapter.ts
import { DataLibraryAdapter } from './adapter.interface.js';

export class ReactQueryAdapter implements DataLibraryAdapter {
  name = 'react-query';
  dataProperty = 'data';
  loadingProperty = 'isLoading';
  errorProperty = 'isError';

  generateQueryCall(hookName: string, input?: string): string {
    const inputStr = input ? `(${input})` : '()';
    return `${hookName}${inputStr}`;
  }

  generateMutationCall(hookName: string, template?: any): string {
    let options = '';
    if (template && template.invalidates.length > 0) {
        const invalidates = template.invalidates.map((i: string) => `queryClient.invalidateQueries({ queryKey: ['${i}'] })`).join('; ');
        options = `({
      onSuccess: () => {
        ${invalidates}
      }
    })`;
    }
    return `${hookName}${options}`;
  }

  generateMemoCall(variable: string, transformer: string): string {
    return `useMemo(() => ${variable}?.${transformer}, [${variable}])`;
  }
}
