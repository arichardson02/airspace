import { randomUUID } from "node:crypto";

try {
  // Loads connector/.env when present; real environment variables take precedence.
  process.loadEnvFile();
} catch {
  // No .env file, fall back to the environment and defaults.
}

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

export const config = {
  appName: "fs-career-connector",
  connectorVersion: process.env.npm_package_version ?? "dev",
  backendUrl,
  flushIntervalMs: 2_000,
  // Group flights are joined only when GROUP_CODE is set.
  groupCode: process.env.GROUP_CODE,
  pilotId: process.env.PILOT_ID ?? `pilot-${randomUUID().slice(0, 4)}`,
  signalingUrl: `${backendUrl.replace(/^http/, "ws")}/group`,
};
