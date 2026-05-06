import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { logger } from "../utils/logger.js";

/**
 * Create a Binder snapshot capturing the current git commit SHA, optional version
 * environment variables, and a SHA‑256 hash of the OpenAPI definition (if present).
 * The snapshot is written to `.binder/snapshots/<timestamp>.json`.
 */
export async function runSnapshot(options: { status?: 'verified' | 'failed' } = {}) {
  const cwd = process.cwd();
  const backendSha = execSync("git rev-parse HEAD", { cwd, stdio: "pipe" }).toString().trim();
  const frontendSha = backendSha; // Assuming a monorepo; adjust as needed.

  const openapiPath = join(cwd, "openapi.json");
  let openapiHash = "";
  if (existsSync(openapiPath)) {
    // Simple SHA256 using openssl available on most dev machines.
    const out = execSync(`openssl sha256 ${openapiPath}`).toString();
    openapiHash = out.split("=")[1].trim();
  }

  const snapshot = {
    id: `sha256-${backendSha.slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    backend: {
      commit: backendSha,
      version: process.env.BACKEND_VERSION || "unknown",
      openapiHash,
    },
    frontend: {
      commit: frontendSha,
      version: process.env.FRONTEND_VERSION || "unknown",
      status: options.status || "unknown",
    },
    status: options.status || "unknown",
  };

  const outDir = join(cwd, ".binder", "snapshots");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${snapshot.timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
  logger.success(`Binder snapshot written to ${outFile}`);
}
