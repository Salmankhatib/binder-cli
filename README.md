# 🔗 Binder: The Sovereign Contract Engine
```text
```html
<div align="center">
<pre>
╔═════════════════════════════════════════════════════╗
║    ██████╗ ██╗███╗   ██╗██████╗ ███████╗██████╗     ║
║    ██╔══██╗██║████╗  ██║██╔══██╗██╔════╝██╔══██╗    ║
║    ██████╔╝██║██╔██╗ ██║██║  ██║█████╗  ██████╔╝    ║
║    ██╔══██╗██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗    ║
║    ██████╔╝██║██║ ╚████║██████╔╝███████╗██║  ██║    ║
║    ╚═════╝ ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═     ║
╚═════════════════════════════════════════════════════╝
             <b>MOCK-TO-API BINDING ENGINE</b>
</pre>
</div>
```

**Binder** is a CLI tool and Dashboard platform that automates the most painful part of frontend development: 
**Connecting your UI to the Backend.** It transforms static mocked frontends into live, API-driven applications while acting as a **Sovereign Sentinel** to ensure your contracts never drift.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007acc.svg)](https://www.typescriptlang.org/)
[![Enterprise Ready](https://img.shields.io/badge/Enterprise-Ready-green.svg)](#)

---

## 🌟 The Binder Core: "Mock-to-Real"

The heart of Binder is the **Surgical Binding Engine**. 
- **The Problem**: You've built a beautiful UI with mock data (`const users = [{...}]`). Now you have to spend hours deleting that code and replacing it with `useQuery`, types, and error handling.
- **The Binder Solution**: Run `binder bind src/MyPage.tsx`. Binder uses AST surgery to surgically swap your mocks for real API hooks, ensuring type safety and zero manual plumbing.

---

## 🚀 Key Pillars

### 1. ⚡ Autonomous Binding
Deterministic AST analysis swaps your mock variables for real API hooks.
- **Deep Data Flow**: Traces data through Props, Redux, and Zustand to find every downstream consumer.
- **Transactional Safety**: If a rewrite breaks your build, Binder reverts it automatically.

### 2. 🛡️ Sovereign Contract Governance
Turn your OpenAPI or tRPC schema into a living, enforced contract.
- **Drift Detection**: Catch field-level mismatches before they hit a Pull Request.
- **Autonomous Repair**: `binder sync --apply` automatically refactors your code when the backend renames a field.
- **Deployment Guard**: A CI sentinel that physically blocks deployments if the frontend-backend contract is unverified.

### 3. 🏗️ Pattern-Driven Scaffolding
Generate code in seconds, not hours.
- **Full-Stack Scaffolding**: Generates Zod schemas, TypeScript types, and React components in one go.
- **Consistency**: Uses your team's exact coding patterns from `.binder/patterns/`.

### 🕹️ The Command Center (Dashboard)
A visual cockpit for your project's health. 
- **One-Click Fixes**: Resolve contract drifts directly from the browser.
- **Time Machine**: Browse snapshots and rollback your project to a last-known-good state.

---

## 🛠️ Quick Start

### 1. Installation
```bash
npm install -g @bindercli/core
```

### 2. Connect Your Project
```bash
binder init
```

### 3. The Surgical Swap
```bash
binder bind src/pages/Dashboard.tsx
```

### 4. Stay in Sync
```bash
binder sync --apply
```

---

## 📖 Learn More

- [User Manual](USER_MANUAL.md) - How to use every command.
- [Architecture](ARCHITECTURE.md) - Under the hood of the Sentinel engine.
- [Security Policy](SECURITY.md) - How we handle your contract data.

MIT © 2026 Binder Team
