// Bundles the Electron main process (with the connector) and the preload script into dist/main, so the
// packaged app needs no node_modules. Shared by scripts/dev.mjs and scripts/build.mjs.

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import manifest from "../package.json" with { type: "json" };

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const addonName = "node_datachannel.node";

// pnpm keeps node-datachannel's Windows build beside it in the connector's store.
export const addonPath = createRequire(
  realpathSync(join(root, "../connector/node_modules/node-datachannel/package.json")),
).resolve(`@node-datachannel/win32-x64-msvc/${addonName}`);

/**
 * node-datachannel finds its native addon relative to its own files, which a bundle moves. Load it from the
 * app's resources folder when packaged, or straight from node_modules in development.
 *
 * @satisfies {esbuild.Plugin}
 */
const nativeAddon = {
  name: "native-addon",
  setup(build) {
    build.onLoad(
      { filter: /node-datachannel[\\/]dist[\\/](esm|cjs)[\\/]lib[\\/]node-datachannel\.(mjs|cjs)$/ },
      () => ({
        contents: `
        import { app } from "electron";
        import { join } from "node:path";
        const file = app.isPackaged ? join(process.resourcesPath, ${JSON.stringify(addonName)}) : ${JSON.stringify(addonPath)};
        const addon = { exports: {} };
        process.dlopen(addon, file);
        export default addon.exports;
      `,
        loader: "js",
      }),
    );
  },
};

/**
 * esbuild options for the main and preload bundles; `release` builds in the production settings.
 *
 * @param {{ release: boolean }} options
 * @returns {esbuild.BuildOptions}
 */
export function mainBuildOptions({ release }) {
  const define = {};
  if (release) {
    define["process.env.AIRSPACE_BUILD_VERSION"] = JSON.stringify(manifest.version);
    define["process.env.AIRSPACE_BUILD_BACKEND_URL"] = JSON.stringify(
      process.env.RELEASE_BACKEND_URL ?? "https://airspace.club/api",
    );
  }

  return {
    entryPoints: { main: join(root, "electron/main.ts"), preload: join(root, "electron/preload.ts") },
    outdir: join(root, "dist/main"),
    outExtension: { ".js": ".cjs" },
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    define,
    plugins: [nativeAddon],
    sourcemap: !release,
    logLevel: "warning",
  };
}

export const bundle = (options) => esbuild.build(options);
