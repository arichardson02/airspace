// Builds everything the installer packs into dist/: the page (dist/renderer), the main process and preload
// (dist/main), node-datachannel's native addon (dist/native), which can't live inside the app archive, and the
// in-sim module and menu script the app installs into the simulator (dist/sim-module, dist/sim-package).

import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build as viteBuild } from "vite";
import { addonName, addonPath, bundle, mainBuildOptions, menuScriptBuildOptions, root } from "./bundle-main.mjs";
import { fetchSimModule } from "./sim-module.mjs";

rmSync(join(root, "dist"), { recursive: true, force: true });

await viteBuild({ root, configFile: join(root, "vite.config.ts") });
await bundle(mainBuildOptions({ release: true }));
await bundle(menuScriptBuildOptions());

mkdirSync(join(root, "dist/native"), { recursive: true });
copyFileSync(addonPath, join(root, "dist/native", addonName));

await fetchSimModule(join(root, "dist/sim-module"));
