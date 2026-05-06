// src/adapters/adapter.interface.ts
export interface DataLibraryAdapter {
  name: string;
  dataProperty: string;
  loadingProperty: string;
  errorProperty: string;
  generateQueryCall(hookName: string, input?: string): string;
  generateMutationCall(hookName: string, template?: any): string;
  generateMemoCall(variable: string, transformer: string): string;
}
