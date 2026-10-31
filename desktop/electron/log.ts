import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { format } from "node:util";

/** Copies console output into `file` (replaced on each start), since a packaged app has no terminal. */
export function logToFile(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const stream = createWriteStream(file, { flags: "w" });

  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      stream.write(`${new Date().toISOString()} ${level.toUpperCase()} ${format(...args)}\n`);
      original(...args);
    };
  }
}
