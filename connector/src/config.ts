try {
  // Loads connector/.env when present; real environment variables take precedence.
  process.loadEnvFile();
} catch {
  // No .env file, fall back to the environment and defaults.
}

export const config = {
  appName: "fs-career-connector",
  connectorVersion: process.env.npm_package_version ?? "dev",
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:3000",
  flushIntervalMs: 2_000,
};
