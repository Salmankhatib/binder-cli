# 📡 Binder MCP Specification (v1.0)

This document outlines the implementation for the **Binder Model Context Protocol (MCP)** server. Implementing MCP allows Binder to act as a "Technical Infrastructure Provider" for external LLMs (like Claude 3.5, GPT-4o, or agentic IDEs).

## 🌍 The "Dual Interface" Concept
Binder remains a **primary CLI tool**. MCP is simply a high-bandwidth "Hacker Port" that allows an AI to control the Binder Core Engine.

- **Human Workflow**: `npm install -g binder` -> `binder bind <file>`
- **AI Workflow**: AI Agent calls `binder_mcp` -> Binder Core Engine -> Returns Repo Intelligence.

---

## 🛠️ MCP Toolset (Capabilities)

The Binder MCP server exposes the following tools to the AI Agent:

### 1. `scan_project`
- **Goal**: Find every unbound mock in the entire monorepo.
- **Input**: `rootPath: string`
- **Output**: A JSON list of files, mock variable names, and inferred data shapes.

### 2. `get_repo_map`
- **Goal**: Provide a full map of the API surface.
- **Output**: JSON containing:
    - List of available hooks.
    - Exported model interfaces.
    - Calculated relative paths for generated code.

### 3. `apply_surgical_binding`
- **Goal**: Trigger the Binder Core to bind a specific file.
- **Input**: `filePath: string`, `options: BindingOptions`
- **Output**: Success status and a git-style diff of the changes made.

### 4. `run_diagnostics`
- **Goal**: Run the Virtual Compiler (`ts-morph`) and return errors.
- **Input**: `code: string`, `filePath: string`
- **Output**: Precise TypeScript errors with line numbers and "Diagnostic Suggestions."

---

## 📂 Resources (Shared Data)

The MCP server provides "Read-Only" access to high-value infrastructure data:
- `binder://current-context`: The live `context.txt` for the current binding session.
- `binder://api-schema`: The full OpenAPI specification being used as the Source of Truth.
- `binder://learned-rules`: The contents of `.binder/cache.json` containing successful mapping patterns.

---

## 🚀 How Users Will Use It

Once you publish to NPM, the user experience for "Binder MCP" is seamless:

1.  **Installation**:
    ```bash
    npm install -g @binder/core
    ```

2.  **Configuration (e.g., in Claude Desktop)**:
    The user adds this entry to their AI config:
    ```json
    "mcpServers": {
      "binder": {
        "command": "binder",
        "args": ["mcp"]
      }
    }
    ```

3.  **Result**:
    The AI now has a "New Skill." When the user says *"Claude, connect my dashboard to the API,"* Claude doesn't just guess code—it **calls Binder's MCP tools** to perform a verified, compiled binding using your AST Surgeon.
