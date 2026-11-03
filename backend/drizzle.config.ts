import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {
  // No .env file, use the environment as-is.
}

export default defineConfig({
  dialect: "postgresql",
  // Each ingest handler owns its tables in a *.schema.ts file next to it.
  schema: "./src/**/*.schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // generate doesn't connect, so it runs without one; the commands that do reject an empty url.
    url: process.env.DATABASE_URL ?? "",
  },
});
