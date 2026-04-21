# 🤖 Binder: The AI-Powered Frontend-to-Backend Binding Engine

**Binder** is a professional-grade CLI tool designed to eliminate the "manual plumbing" of connecting React frontends to backends. It uses AST-based surgical rewrites and a 3-layer self-healing validation waterfall to replace mock data with real, type-safe API hooks.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007acc.svg)](https://www.typescriptlang.org/)

## 🚀 Key Features

- **AST Surgical Rewrites**: Uses `ts-morph` to manipulate your code at the syntax tree level. No fragile regex.
- **Semantic Mapping**: Matches UI mocks to API endpoints by comparing data shapes (keys/types) rather than just names.
- **3-Layer Validation Waterfall**:
  1. **Type Safety**: Real-time TypeScript compilation checks.
  2. **Shape Integrity**: Verifies that your JSX uses fields that actually exist in the API.
  3. **E2E Integration**: Live data-fetching tests against your running backend.
- **AI Self-Healing**: Automatically repairs type mismatches and "Rules of Hooks" violations using a stateful LLM loop.
- **Persistent Memory**: Remembers successful bindings in `.binder/cache.json` to speed up future runs.

## 📦 Installation

```bash
npm install -g @bindercli/core
```

## 🛠️ Usage

### 1. Initialize Configuration
Create a `binder.config.json` in your project root:

```json
{
  "backend": {
    "python": "./app/main.py"
  },
  "frontend": {
    "generatedDir": "./src/generated"
  },
  "llm": {
    "provider": "openai",
    "model": "gpt-4-turbo-preview"
  }
}
```

### 2. Run the Binder
Bind a component to your API in one command:

```bash
binder bind src/pages/Dashboard.tsx --verbose
```

### 3. Run with E2E Integration
Verify that the live backend data perfectly fits your UI:

```bash
binder bind src/pages/Dashboard.tsx --with-integration
```

## 🧠 Why Binder?

Binder is designed for developers who want the speed of AI without the risk of broken builds. It is the only tool that combines:
- **Agentic Discovery**: Binder can proactively "crawl" your repository to find the types it needs to solve an error.
- **Compiler-Grade Reliability**: Every change is verified by a real instance of the TypeScript compiler. If it doesn't build, Binder doesn't deliver it.
- **Surgical Precision**: By using AST rather than string replacement, we preserve your original formatting, comments, and logic.

Binder acts as the **"Safe Hands"** of your development cycle, handling the complex logic mapping that traditional AI tools often hallucinate.

## 📦 How it works in your Repo

1. **Install**: `npm install -g @bindercli/core`
2. **Setup**: Run `binder init` to scaffold your configuration.
3. **Bind**: Run `binder bind src/pages/YourPage.tsx`
4. **Result**: Binder performs the surgery, compiles the file in a virtual environment, and only overwrites your file once the compiler gives a green light.

## 📄 License
MIT © 2026 Binder Team
