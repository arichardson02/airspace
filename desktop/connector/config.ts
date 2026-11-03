// The desktop app's release build sets AIRSPACE_BUILD_* to its built-in settings, so a stray .env in
// whatever folder it starts from can't redirect it.
if (process.env.AIRSPACE_BUILD_VERSION === undefined || process.env.AIRSPACE_BUILD_VERSION === "") {
  try {
    // Loads desktop/.env in development (scripts/dev.mjs starts Electron there); real environment variables
    // take precedence.
    process.loadEnvFile();
  } catch {
    // No .env file, fall back to the environment and defaults.
  }
}

// Everything the backend serves is under /api, including sign-in (/api/auth).
const backendUrl = process.env.BACKEND_URL ?? process.env.AIRSPACE_BUILD_BACKEND_URL ?? "http://localhost:3000/api";

export const config = {
  appName: "fs-career-connector",
  connectorVersion: process.env.AIRSPACE_BUILD_VERSION ?? process.env.npm_package_version ?? "dev",
  backendUrl,
  flushIntervalMs: 2_000,
  signalingUrl: `${backendUrl.replace(/^http/, "ws")}/group`,
  simRetryMs: 5_000,
};
