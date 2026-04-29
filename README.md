# 🔗 Binder: A Helper for Frontend-to-Backend Binding

**Binder** is a CLI utility designed to assist with the repetitive task of connecting React frontends to backends. It uses deterministic AST-based rules to replace mock data with real API hooks where safe, and provides detailed guidance for everything else.

**No LLM. No Guessing. Built for Developers.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007acc.svg)](https://www.typescriptlang.org/)

## 🚀 Key Features

- **80/20 Migration Strategy**: Automatically converts simple patterns (direct assignments, basic maps) and leaves `TODO(BINDER)` comments for complex logic that requires a human eye.
- **Ensemble Matching**: Uses a combination of name-based heuristics, data shape analysis, and project context to suggest the best API hook for your mock.
- **Compliance Validation**: Runs your project's own TypeScript compiler (`ts-morph`) on changes in memory. If a rewrite breaks your build, Binder reverts it and flags it for review.
- **Autonomous Mechanical Repair**: Uses the Model Context Protocol (MCP) to fix simple syntax or import issues automatically during the migration.
- **Learning Cache**: Remembers your manual binding choices. The more you use it in a project, the more it can automate recurring patterns.

## 🛠️ Usage

### 1. Initialize
Auto-detect your project structure and schema:
```bash
binder init
```

### 2. Bind
Run on a specific file to start the migration:
```bash
binder bind src/pages/Dashboard.tsx
```

### 3. Review
Search your codebase for `TODO(BINDER)` to find complex cases that need manual attention. Binder provides instructions and the original compiler error in the comment.

## 🧠 Why Binder?

Binder is an **assistant**, not a replacement for engineering judgment.
- **Safe by Default**: Transactional rewrites mean your code is never left in a broken state.
- **Transparent**: Every decision is logged, and complex patterns are always deferred to you.
- **Surgical**: Preserves your formatting and logic by manipulating the AST directly.

## 📄 License
MIT © 2026 Binder Team
