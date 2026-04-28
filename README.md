# 🔗 Binder: The Deterministic Frontend-to-Backend Binding Engine

**Binder** is a professional-grade CLI tool designed to eliminate the "manual plumbing" of connecting React frontends to backends. It uses AST-based surgical rewrites and a deterministic validation waterfall to replace mock data with real, type-safe API hooks. 

**No LLM. No Guessing. 100% Type-Safe.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007acc.svg)](https://www.typescriptlang.org/)

## 🚀 Key Features

- **80/20 Safe Binding**: Automatically converts "Safe Patterns" (direct assignments, simple maps, prop passing) and leaves professional `TODO(BINDER)` comments for complex cases.
- **Hybrid Matching Engine**: Matches UI mocks to API hooks by combining name-based heuristics with shape-based semantic analysis (comparing data keys/types).
- **Compliance-First Validation**: Uses your project's own `tsconfig.json` to verify every change before saving. If it doesn't compile, it doesn't commit.
- **Autonomous Repair via MCP**: Leverages the Model Context Protocol (MCP) to fix mechanical issues like missing imports or syntax errors automatically.
- **Mock Server Detection**: Proactively identifies MSW and MirageJS handlers, flagging them for removal once your components are bound.
- **Persistent Memory**: A global cache remembers your manual binding choices across your entire monorepo, enabling auto-binding for recurring patterns.

## 🛠️ Usage

### 1. Initialize Configuration
Run `binder init` to auto-detect your project structure, OpenAPI schema, and UI components:

```bash
binder init
```

### 2. Bind a Component
Bind a component to your API in one command:

```bash
binder bind src/pages/Dashboard.tsx
```

### 3. Review & Refine
For complex patterns, Binder leaves a clear manual review block:
```typescript
/* TODO(BINDER): Manual Review Required - conditional-logic
Mock: MOCK_USER
Suggested Hook: useGetUser
*/
```

## 🧠 Why Binder?

Binder is designed for developers who want speed without hallucinations.
- **Compiler-Grade Reliability**: Every change is verified by a real instance of the TypeScript compiler.
- **Human-in-the-Loop**: The tool handles the boring 80% and empowers the dev to handle the difficult 20% with clear instructions.
- **Surgical Precision**: Preserves your original formatting, comments, and logic.

## 📄 License
MIT © 2026 Binder Team
