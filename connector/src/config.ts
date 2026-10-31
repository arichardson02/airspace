try {
  // Loads connector/.env when present; real environment variables take precedence.
  process.loadEnvFile();
} catch {
  // No .env file, fall back to the environment and defaults.
}

// Everything the backend serves is under /api, including sign-in (/api/auth).
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000/api";

export const config = {
  appName: "fs-career-connector",
  connectorVersion: process.env.npm_package_version ?? "dev",
  backendUrl,
  flushIntervalMs: 2_000,
  // Group flights are joined only when GROUP_CODE is set.
  groupCode: process.env.GROUP_CODE,
  signalingUrl: `${backendUrl.replace(/^http/, "ws")}/group`,
};
