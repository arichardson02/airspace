// Builds everything the installer packs into dist/: the page (dist/renderer), the main process and preload
// (dist/main), and node-datachannel's native addon (dist/native), which can't live inside the app archive.

import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build as viteBuild } from "vite";
import { addonName, addonPath, bundle, mainBuildOptions, root } from "./bundle-main.mjs";

rmSync(join(root, "dist"), { recursive: true, force: true });

await viteBuild({ root, configFile: join(root, "vite.config.ts") });
await bundle(mainBuildOptions({ release: true }));

mkdirSync(join(root, "dist/native"), { recursive: true });
copyFileSync(addonPath, join(root, "dist/native", addonName));
