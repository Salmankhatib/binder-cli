# 📖 Binder User Manual: The Sentinel's Guide

Binder is a high-fidelity system for governing the contract between your Frontend and Backend. This manual covers every command from basic binding to enterprise-scale contract migration.

---

## 🛠️ The "Big Three" Workflows

### 1. The Surgical Swap (`binder bind`)
**Use Case:** You have a file with mock data and want to connect it to a real API.

```bash
binder bind src/components/UserTable.tsx --interactive
```
- **What happens:** Binder scans for mock arrays or objects, compares them to your OpenAPI/tRPC schema, and replaces them with the correct API hook.
- **Flags:**
    - `--interactive`: Recommended. Review and confirm every swap.
    - `--dry-run`: Preview the code changes without saving.
    - `--batch`: Process multiple files at once.

### 2. Autonomous Migration (`binder sync --apply`)
**Use Case:** The backend team renamed a field in the API, and you don't want to hunt down every usage.

```bash
binder sync --apply
```
- **What happens:** Binder compares your current schema against the last verified snapshot. If it detects a rename (e.g., `user_name` → `fullName`), it performs a **project-wide refactor** using AST surgery.
- **Scope:** Updates components, hooks, state slices (Redux/Zustand), and Zod schemas.

### 3. CI/CD Gatekeeping (`binder deploy-guard`)
**Use Case:** Ensure no "broken" contracts ever reach production.

```bash
binder deploy-guard
```
- **What happens:** In your CI pipeline, Binder checks the current commit against the Snapshot Registry. If the current contract drift is unverified or failed, the command exits with `code 1`, blocking the deployment.

---

## 🏗️ Command Reference

### Core Operations
| Command | Description |
|:--- |:--- |
| `binder init` | Detects project DNA and sets up the Sentinel registry. |
| `binder drift` | Deep field-level comparison between your code and the schema. |
| `binder scaffold` | Generates Zod schemas + Hooks + UI from an API endpoint. |
| `binder undo` | Transactional safety net: Reverts the last operation. |

### Visual Governance
| Command | Description |
|:--- |:--- |
| `binder dashboard` | Generates the visual report for your project. |
| `binder serve` | Hosts the **Command Center** UI and version capabilities. |
| `binder verify -t <tag>` | Manually cross-check compatibility with a specific backend version. |

---

## 🕹️ Using the Command Center
Run `binder serve` to open the interactive Cockpit in your browser.

1. **Drift Resolver**: View a list of all detected mismatches. Click **[Apply Fix]** to trigger the Migration Engine without leaving the browser.
2. **Scaffold Map**: Browse all API endpoints. Click **[+] Scaffold** to instantly generate a new component into your project.
3. **Time Machine**: Browse past contract states. If a release was buggy, click **Restore** to revert to the last stable contract version.

---

## 🤖 Advanced: Learning Cache
Binder learns from your confirmations. When you confirm a match in `--interactive` mode, Binder saves that "Knowledge Link" in `.binder/cache.json`. The next time that same mock appears elsewhere, Binder will suggest the correct API hook with 99% confidence.

---

## 🛡️ Best Practices
1. **Snapshot Early, Snapshot Often**: Run `binder snapshot` after every successful API integration.
2. **Commit Your Registry**: Always commit the `.binder/snapshots/` directory so your team (and CI) shares the same source of truth.
3. **Template Your Style**: Edit the files in `.binder/patterns/` to make sure `scaffold` generates code that matches your team's exact style.