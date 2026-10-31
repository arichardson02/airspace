// The desktop app's release build sets AIRSPACE_BUILD_* to its built-in settings, so a stray .env in
// whatever folder it starts from can't redirect it.
if (!process.env.AIRSPACE_BUILD_VERSION) {
  try {
    // Loads connector/.env when present; real environment variables take precedence.
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
  // In the terminal, a group flight is joined whenever GROUP_CODE is set. The desktop app joins from its window.
  groupCode: process.env.GROUP_CODE,
  signalingUrl: `${backendUrl.replace(/^http/, "ws")}/group`,
  simRetryMs: 5_000,
};
