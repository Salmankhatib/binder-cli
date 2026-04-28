// src/common/types.ts

export interface Binding {
  mockName: string;
  hookName: string;
  confidence: number;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
  transformer?: string;
  loadingStrategy?: 'early-return-skeleton' | 'suspense' | 'none';
  errorStrategy?: 'early-return-error' | 'none';
}

export interface BindingPlan {
  bindings: Binding[];
}

export interface TestResult {
  filePath: string;
  success: boolean;
  errors?: Array<{ line: number; message: string; type: string }>;
  fixesApplied?: number;
}
