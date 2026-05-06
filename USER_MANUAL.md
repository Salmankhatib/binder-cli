# 📖 Binder User Manual

This manual provides a detailed walkthrough of all Binder commands and the recommended Enterprise workflow.

---

## 🛠️ Command Reference

### Core Binding
| Command | Flag | Description |
|:--- |:--- |:--- |
| `binder bind <path>` | `--interactive` | Manually review and confirm every surgical swap. |
| `binder bind <path>` | `--dry-run` | Preview AST changes in the terminal without saving. |
| `binder bind <path>` | `--batch` | Process all files in a directory sequentially. |
| `binder bind <path>` | `--repo` | Full project sweep: propagate confirmed matches globally. |

### Contract Management (The Sentinel)
| Command | Description |
|:--- |:--- |
| `binder drift` | Performs deep field-level comparison between code and schema. |
| `binder watch` | Real-time local sentinel that alerts you of drift while you code. |
| `binder snapshot` | Captures an immutable record of your API hash and Git state. |
| `binder deploy-guard` | **CI Command**: Aborts deployment if the contract is unverified. |

### Governance & Visuals
| Command | Description |
|:--- |:--- |
| `binder dashboard` | Generates a cinematic HTML report with rollback intelligence. |
| `binder serve` | Hosts the dashboard and version capabilities for your team. |
| `binder upgrade` | Analyzes snapshots to generate a step-by-step migration plan. |

### Infrastructure
| Command | Description |
|:--- |:--- |
| `binder init` | Interactive TUI to setup project structure and protocols. |
| `binder scaffold` | Generates UI components and hooks from OpenAPI endpoints. |
| `binder undo` | Reverts the last surgical operation on a file. |

---

## 🤖 CI/CD Integration

Binder is designed to be the "Source of Truth" in your pipeline.

### 1. The Pull Request Gatekeeper
Add `binder drift` to your PR workflow. If a backend change renames a field that the frontend relies on, the build will fail.

### 2. Automated PR Comments
Binder can be configured to post comments on PRs:
> ⚠️ **Contract Drift Detected**
> I detected that `POST /api/users` has changed. Run `binder scaffold /users --write` to fix.

### 3. Deployment Safety
Run `binder deploy-guard` in your CD pipeline. It cross-references the current commit against the verified snapshots. If no verified snapshot exists for the current contract, the deployment is blocked.

---

## 🧠 Best Practices

1. **Snapshots are Sacred**: Always run `binder snapshot` after a successful manual verification.
2. **Interactive First**: Use `--interactive` on your first few files to train the Binder Learning Cache.
3. **Template the Boring Stuff**: Spend 10 minutes setting up your `.binder/patterns/` to ensure `scaffold` matches your team's style.