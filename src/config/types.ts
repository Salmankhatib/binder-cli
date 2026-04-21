export interface Config {
  backend: {
    /** Absolute or relative path to FastAPI Python file */
    python?: string;
    /** URL to running OpenAPI JSON (alternative to python) */
    url?: string;
  };
  frontend: {
    /** Where Orval outputs generated code */
    generatedDir: string;
  };
  orval: {
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
  }>;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};