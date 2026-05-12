// src/mcp/oracle.ts

export interface Diagnostic {
  message: string;
  code: number;
  line: number;
  character: number;
  file: string;
}
