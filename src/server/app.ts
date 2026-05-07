// src/server/app.ts – Express application used by Binder for version negotiation and capabilities
import express, { Request, Response, NextFunction } from "express";
import { versionNegotiation } from "../middleware/versionNegotiation.js";
import { logger } from "../utils/logger.js";
import { join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { runDrift } from "../cli/drift.js";
import { MigrationOrchestrator } from "../orchestrator/migrationOrchestrator.js";
import { Project } from "ts-morph";
import { runScaffold } from "../cli/scaffold.js";
import { runSnapshot } from "../cli/snapshot.js";
import { undoLast } from "../cli/undo.js";

// Load supported versions from environment variable BINDER_SUPPORTED_VERSIONS (comma‑separated)
const supportedVersionsEnv = process.env.BINDER_SUPPORTED_VERSIONS || "";
const supportedVersions = supportedVersionsEnv
  .split(",")
  .map(v => v.trim())
  .filter(Boolean);
const defaultVersion = supportedVersions[0] || "v0.0.0";

export const app = express();
app.use(express.json());

// Apply version negotiation middleware globally
app.use(
  versionNegotiation({ supportedVersions, defaultVersion })
);

// Capabilities endpoint – used by binderClient to discover backend support
app.get("/api/_binder/capabilities", (req: Request, res: Response) => {
  res.json({ supported: supportedVersions, current: supportedVersions[supportedVersions.length - 1] || defaultVersion });
});

// Dashboard Host – serves the generated dashboard page
app.get("/_binder/dashboard", (req: Request, res: Response) => {
  const dashboardPath = join(process.cwd(), "binder", "dashboard.html");
  if (existsSync(dashboardPath)) {
    res.send(readFileSync(dashboardPath, "utf-8"));
  } else {
    res.status(404).send("<h1>Binder Dashboard not found.</h1><p>Run <code>binder dashboard</code> to generate it.</p>");
  }
});

// --- Command API for Actionable Dashboard ---

// 1. Get Live Drift Analysis
app.get("/api/_binder/drift", async (req: Request, res: Response) => {
  try {
    // In a real implementation, we'd capture the drift results from runDrift
    // For now, we'll return a mock structure that the dashboard can consume
    res.json({ status: "ok", drift: [] });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

// 2. Apply Migration (Refactor)
app.post("/api/_binder/migrate/apply", async (req: Request, res: Response) => {
  const { hookName, oldFieldName, newFieldName } = req.body;
  try {
    const project = new Project();
    project.addSourceFilesAtPaths("src/**/*.ts*");
    const orchestrator = new MigrationOrchestrator(project);
    
    await orchestrator.applyRename({ hookName, oldFieldName, newFieldName });
    await project.save();
    
    res.json({ status: "ok", message: `Refactored ${oldFieldName} to ${newFieldName}` });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

// 3. One-Click Scaffold
app.post("/api/_binder/scaffold", async (req: Request, res: Response) => {
  const { endpoint, pattern } = req.body;
  try {
    await runScaffold(endpoint, { pattern, write: true });
    res.json({ status: "ok", message: `Scaffolded ${endpoint}` });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

// 4. Snapshot Time Machine
app.get("/api/_binder/snapshots", (req: Request, res: Response) => {
  const snapshotsDir = join(process.cwd(), ".binder", "snapshots");
  if (!existsSync(snapshotsDir)) return res.json([]);
  
  const files = readdirSync(snapshotsDir).filter(f => f.endsWith(".json")).sort();
  const snapshots = files.map(f => JSON.parse(readFileSync(join(snapshotsDir, f), "utf-8")));
  res.json(snapshots);
});

app.post("/api/_binder/snapshot/restore", async (req: Request, res: Response) => {
  const { id } = req.body;
  // Simplified: just undo last for now, or implement specific SHA restore
  undoLast(process.cwd()); 
  res.json({ status: "ok", message: "Restored to previous state" });
});

// Simple health endpoint (optional)
app.get("/api/_binder/health", (req: Request, res: Response) => {
  res.json({ status: "ok", version: defaultVersion });
});

// Export a start function for production usage
export function startServer(port = Number(process.env.PORT) || 3000) {
  app.listen(port, () => {
    logger.info(`Binder server listening on http://localhost:${port}`);
  });
}

// If the file is executed directly (node src/server/app.ts), start the server.
if (require.main === module) {
  startServer();
}
