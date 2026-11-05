// Development: serves the window's page from Vite (with hot reload), and rebuilds and restarts Electron
// whenever the main process or the connector changes. The connector reads desktop/.env.

import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { createServer } from "vite";
import { bundle, mainBuildOptions, menuScriptBuildOptions, root } from "./bundle-main.mjs";

// Required from Node, the electron package exports the path to its executable. require() returns any, and
// String() gives that path its type.
const electron = String(createRequire(import.meta.url)("electron"));

const server = await createServer({ root, configFile: join(root, "vite.config.ts") });
await server.listen();
const url = server.resolvedUrls.local[0];

/** @type {import("node:child_process").ChildProcess | undefined} */
let child;
// Set while a rebuild replaces the running Electron, so its exit doesn't end the dev session.
let restarting = false;
let quitting = false;

function startElectron() {
  restarting = false;
  // Extra arguments go to Electron, e.g. pnpm dev --remote-debugging-port=9222.
  child = spawn(electron, [join(root, "dist/main/main.cjs"), ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
    stdio: "inherit",
  });
  child.on("exit", () => {
    // Closing the window ends the dev session; a restart after a rebuild doesn't.
    if (restarting) return;
    quitting = true;
    void context
      .dispose()
      .then(() => server.close())
      .then(() => process.exit(0));
  });
}

/** @satisfies {esbuild.Plugin} */
const restartElectron = {
  name: "restart-electron",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0 || quitting) return;
      if (child === undefined) {
        startElectron();
        return;
      }
      restarting = true;
      child.once("exit", startElectron);
      child.kill();
    });
  },
};

// The app bundles the contracts' built output, so they're built first: a pull alone would otherwise leave an old
// co-op protocol in the bundle, and peers would quietly fall back to sharing only the motion.
const contracts = spawnSync("pnpm", ["--filter", "@fs-career/contracts", "build"], { stdio: "inherit", shell: true });
if (contracts.status !== 0) throw new Error("Couldn't build the contracts");
// The menu script is built once; the app installs it into the sim at launch.
await bundle(menuScriptBuildOptions());
const options = mainBuildOptions({ release: false });
const context = await esbuild.context({ ...options, plugins: [...(options.plugins ?? []), restartElectron] });
await context.watch();
