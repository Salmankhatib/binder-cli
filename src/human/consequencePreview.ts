// src/human/consequencePreview.ts
import { MockFinding, Usage } from '../engine/types.js';

export class DiffPreviewGenerator {
  generateClientPagination(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
- const ${mock.name.toLowerCase()} = ${mock.name};
+ const { data: ${mock.name.toLowerCase()}Raw } = ${hookName}();
+ const ${mock.name.toLowerCase()} = useMemo(() => 
+   ${mock.name.toLowerCase()}Raw?.slice(page * size, (page + 1) * size) ?? []
+ , [${mock.name.toLowerCase()}Raw, page, size]);`;
  }

  generateServerPagination(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
- const ${mock.name.toLowerCase()} = ${mock.name};
+ const { data: ${mock.name.toLowerCase()} } = ${hookName}({ page, size });`;
  }

  generateClientSort(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
+ const { data: raw } = ${hookName}();
+ const sorted = useMemo(() => [...(raw ?? [])].sort((a,b) => ...), [raw, sortField]);`;
  }

  generateServerSort(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
+ const { data } = ${hookName}({ sort: { field, order } });`;
  }

  generateClientFilter(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
+ const { data: raw } = ${hookName}();
+ const filtered = useMemo(() => raw?.filter(item => ...), [raw, filters]);`;
  }

  generateDebouncedSearch(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
+ const debouncedTerm = useDebounce(searchTerm, 300);
+ const { data } = ${hookName}({ search: debouncedTerm });`;
  }

  generatePessimisticMutation(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
+ const mutation = ${hookName}();
+ const handleSubmit = () => mutation.mutate(data);`;
  }

  generateOptimisticMutation(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
+ const mutation = ${hookName}({
+   onMutate: async (newData) => { ... },
+   onError: (err, newData, context) => { ... }
+ });`;
  }

  generateKeepProps(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
- // received ${mock.name} via props
+ // parent calls hook and passes down real data
+ const { data } = ${hookName}();`;
  }

  generateInlineHooks(mock: MockFinding, usages: Usage[], hookName: string, depth: string): string {
    return `
// In each component of the ${depth} drill chain:
- // received via props: { ${mock.name.toLowerCase()} }
+ const { data: ${mock.name.toLowerCase()} } = ${hookName}();`;
  }

  generateDefault(mock: MockFinding, usages: Usage[], hookName: string): string {
    return `
- const ${mock.name.toLowerCase()} = ${mock.name};
+ const { data: ${mock.name.toLowerCase()}, isLoading } = ${hookName}();`;
  }
}
