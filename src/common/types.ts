// src/common/types.ts

export interface Binding {
  mockName: string;
  hookName: string;
  confidence: number;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
  strategy?: string;
  transformer?: string;
  transformationExpression?: string;
  loadingStrategy?: 'early-return-skeleton' | 'suspense' | 'none';
  errorStrategy?: 'early-return-error' | 'none';
  inferredInput?: string;
  mutationTemplate?: {
    invalidates: string[];
    hasOnSuccess: boolean;
    hasOnError: boolean;
  };
  manualCode?: string;
}

export interface BindingPlan {
  bindings: Binding[];
  loadingTemplate?: string;
  errorTemplate?: string;
  protocol?: 'rest' | 'trpc';
  trpcExportName?: string;
}

export interface TestResult {
  filePath: string;
  success: boolean;
  errors?: Array<{ line: number; message: string; type: string }>;
  fixesApplied?: number;
}

export type StateProvider = 'redux' | 'zustand' | 'context';

export interface DataFlowNode {
  id: string;
  kind: 'write' | 'read';
  provider: StateProvider;
  sliceKey: string;
  dataField: string;
  file: string;
  line: number;
}

export interface DataFlowEdge {
  from: string;
  to: string;
  via: string;
}

export interface DataFlowGraph {
  nodes: Map<string, DataFlowNode>;
  edges: DataFlowEdge[];
}
