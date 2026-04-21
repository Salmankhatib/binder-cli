# 🛡️ Security Policy

## Supported Versions

We only provide security updates for the current major version.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability within Binder (especially regarding LLM prompt injection or credential handling), please send an email to security@binder.dev. All security vulnerabilities will be promptly addressed.

## LLM Data Privacy

Binder sends snippets of your source code and API schemas to your configured LLM provider (OpenAI, Gemini, or Anthropic).
- **Credentials**: Binder reads API keys from your local `.env`. Ensure this file is in your `.gitignore`.
- **Local AI**: For sensitive environments, use the `ollama` provider to keep all data on your local machine.
