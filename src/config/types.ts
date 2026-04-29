export interface Config {
  backend: {
    /** Path to openapi.json file or URL to running OpenAPI JSON */
    schemaPath: string;
    /** Optional base URL for API requests */
    url?: string;
    /** Schema format */
    schemaFormat?: 'yaml' | 'json' | 'url';
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
  llm: {
    /** 'ollama' | 'openai' | 'gemini' */
    provider: string;
    /** Model name, e.g. 'codellama:13b' */
    model: string;
    /** API host */
    host: string;
    /** Temperature (0.0 - 1.0) */
    temperature: number;
    /** Max retries for repair loop */
    maxRetries: number;
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