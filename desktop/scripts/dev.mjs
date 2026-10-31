// Development: serves the window's page from Vite (with hot reload), and rebuilds and restarts Electron
// whenever the main process or the connector changes. The connector reads connector/.env, as it does
// in the terminal.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { createServer } from "vite";
import { mainBuildOptions, root } from "./bundle-main.mjs";

const electron = createRequire(import.meta.url)("electron");

const server = await createServer({ root, configFile: join(root, "vite.config.ts") });
await server.listen();
const url = server.resolvedUrls.local[0];

let child;
let quitting = false;

function startElectron() {
  // Extra arguments go to Electron, e.g. pnpm dev --remote-debugging-port=9222.
  child = spawn(electron, [join(root, "dist/main/main.cjs"), ...process.argv.slice(2)], {
    cwd: join(root, "../connector"),
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
    stdio: "inherit",
  });
  child.on("exit", () => {
    // Closing the window ends the dev session; a restart after a rebuild doesn't.
    if (child.restarting) return;
    quitting = true;
    void context
      .dispose()
      .then(() => server.close())
      .then(() => process.exit(0));
  });
}

const context = await esbuild.context({
  ...mainBuildOptions({ release: false }),
  plugins: [
    ...mainBuildOptions({ release: false }).plugins,
    {
      name: "restart-electron",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0 || quitting) return;
          if (!child) return startElectron();
          child.restarting = true;
          child.once("exit", startElectron);
          child.kill();
        });
      },
    },
  ],
});
await context.watch();
