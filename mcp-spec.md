# 📡 Binder MCP Specification (v1.0)

This document outlines the **Binder Model Context Protocol (MCP)** implementation. Binder acts as both an MCP **Client** (using mechanical repair tools) and an MCP **Server** (exposing repo intelligence to external agents).

## 🌍 The "Dual Role" Concept
1. **As a Client**: Binder connects to the `ts-repair` MCP server to autonomously fix mechanical syntax and import issues discovered during the compliance check.
2. **As a Server**: Binder allows external AI agents (Claude, GPT) to control its deterministic binding engine via a standardized toolset.

---

## 🛠️ MCP Toolset (Server Capabilities)

### 1. `get_compliance_report`
- **Goal**: Run the Virtual Compiler and return errors for a specific file.
- **Input**: `filePath: string`
- **Output**: Detailed TypeScript diagnostics mapped to your `tsconfig.json`.

### 2. `trigger_safe_bind`
- **Goal**: Bind a file using the deterministic safe-only engine.
- **Input**: `filePath: string`
- **Output**: Success status and a list of `TODO(BINDER)` manual review points.

### 3. `get_learned_patterns`
- **Goal**: Share the global cache of successful bindings.
- **Output**: JSON of `mockName` -> `hookName` mappings learned from the user.

---

## 📂 Resources (Shared Data)
- `binder://learned-rules`: The contents of `.binder/cache.json`.
- `binder://api-hooks`: The AST-reflected list of available API hooks.

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
