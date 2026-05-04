// src/adapters/reactQuery.adapter.ts
import { DataLibraryAdapter } from './adapter.interface.js';

export class ReactQueryAdapter implements DataLibraryAdapter {
  name = 'react-query';
  dataProperty = 'data';
  loadingProperty = 'isLoading';
  errorProperty = 'isError';

  generateQueryCall(hookName: string): string {
    return `${hookName}()`;
  }

  generateMemoCall(variable: string, transformer: string): string {
    return `useMemo(() => ${variable}?.${transformer}, [${variable}])`;
  }
}
