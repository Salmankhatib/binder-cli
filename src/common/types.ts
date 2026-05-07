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
