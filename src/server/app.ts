// src/server/app.ts – Express application used by Binder for version negotiation and capabilities
import express, { Request, Response, NextFunction } from "express";
import { versionNegotiation } from "../middleware/versionNegotiation.js";
import { logger } from "../utils/logger.js";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

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
