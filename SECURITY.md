# 🛡️ Security Policy

Binder is built with a **Security-First** mindset. Since we operate on your core source code and API schemas, we maintain strict boundaries on data handling.

---

## 🔒 Contract Integrity
Binder's **Sentinel Layer** ensures that your API contracts are immutable:
- **Snapshots**: Use SHA-256 hashing to verify that the schema has not been tampered with.
- **Verification**: Only snapshots marked as `verified` can pass the `deploy-guard`.

---

## 🌐 Auxiliary Server (`binder serve`)
The Binder server is designed for **internal staging/development use only**.
- **Scope**: It serves version capability headers and a read-only dashboard.
- **Warning**: Do not expose the Binder server to the public internet without a VPN or authenticated proxy.

---

## 🧠 LLM Data Privacy
Binder is **LLM-Optional**.
- **Local-Only**: By default, Binder uses deterministic AST rules that stay 100% on your machine.
- **Privacy Mode**: If you enable LLM Fallback, we recommend using the `ollama` provider to keep all data on your local hardware.

---

## 🚩 Reporting a Vulnerability
**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability (especially regarding credential handling or the dashboard host), please send an email to **security@binder.dev**.
