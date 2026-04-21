# 🤝 Contributing to Binder

We welcome contributions! As an AI-native tool, we value performance, type safety, and architectural cleanliness.

## 🛠️ Development Setup

1. **Clone & Install**:
   ```bash
   git clone https://github.com/salmankhatib/binder.git
   npm install
   ```

2. **Run Tests**:
   Binder is tested against the `examples/` directory.
   ```bash
   cd packages/core
   npm run build
   node dist/cli.js bind examples/ecommerce/frontend/src/pages/Dashboard.tsx
   ```

## 📜 Coding Standards

- **AST First**: Never use `String.replace` for code modifications. Use `ts-morph` in `astRewriter.ts`.
- **Stateless core**: The core logic should remain backend-agnostic.
- **Deterministic Fixes**: If an error can be fixed without an LLM (e.g., adding `?? []`), add it to `deterministicFixes.ts` to save user costs.

## 🧪 Submission Process

1. Create a Feature Branch.
2. Add a new test case in `examples/`.
3. Verify that the `repairLoop` can solve your test case.
4. Submit a PR with a description of the architectural change.
