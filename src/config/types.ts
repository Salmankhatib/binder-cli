export interface Config {
  /** The protocol used by the project */
  protocol: 'rest' | 'trpc';
  backend: {
    /** Path to openapi.json file or URL to running OpenAPI JSON (for REST) */
    schemaPath?: string;
    /** Optional base URL for API requests */
    url?: string;
    /** Schema format (for REST) */
    schemaFormat?: 'yaml' | 'json' | 'url';
    /** Path to the AppRouter type definition (for tRPC) */
    trpcAppRouterPath?: string;
    /** Name of the exported trpc client (for tRPC, e.g. 'trpc') */
    trpcExportName?: string;
  };
  frontend: {
    /** Where Orval outputs generated code */
    generatedDir: string;
    loadingTemplate?: string;
    errorTemplate?: string;
    existingHooksDir?: string;
    componentsDir?: string;
    pagesDir?: string;
  };
  mockDetection?: {
    importPatterns?: string[];      // ["**/*.mock.ts", "**/fixtures/**"]
    variablePrefixes?: string[];    // ["MOCK_", "DEMO_", "SAMPLE_"]
    variableSuffixes?: string[];    // ["_DATA", "_MOCK"]
    factoryFunctions?: string[];    // ["createUser", "generateOrder"]
    ignorePatterns?: string[];      // ["**/*.test.ts"]
  };
  orval?: {
    /** Which query client to generate */
    client: 'react-query' | 'swr' | 'vue-query';
    /** Base URL for axios instance */
    baseUrl?: string;
  };
  llm?: {
    /** Whether LLM fallback is enabled */
    enabled: boolean;
    /** 'ollama' | 'openai' | 'anthropic' | 'google' | 'deepseek' */
    provider?: string;
    /** Model name, e.g. 'llama3', 'gpt-4o' */
    model?: string;
    /** API host (for ollama or custom endpoint) */
    host?: string;
    /** Temperature (0.0 - 1.0) */
    temperature?: number;
    /** Max retries for repair loop */
    maxRetries?: number;
  };
  mcpServers?: Array<{
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
  mcpFallback?: 'skip' | 'basic-todo' | 'local-llm';
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};