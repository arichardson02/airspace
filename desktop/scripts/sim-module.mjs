// Fetches MobiFlight's WASM module (MIT, github.com/MobiFlight/MobiFlight-WASM-Module), which the app installs into
// the simulator's Community folder so the connector can press cockpit buttons only in-sim code can reach. Pinned and
// checked, so a release can't change under us.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VERSION = "1.0.1";
const URL = `https://github.com/MobiFlight/MobiFlight-WASM-Module/releases/download/${VERSION}/mobiflight-event-module.${VERSION}.zip`;
const SHA256 = "01c6a8a29c696e7353cf63c231a5b9b0dc408c5ce731c50cd4c3e735cd624f1f";
const SIM_MODULE_PACKAGE = "mobiflight-event-module";

/**
 * Puts the module package in `dir/mobiflight-event-module`, downloading it unless it's already there.
 *
 * @param {string} dir
 */
export async function fetchSimModule(dir) {
  if (existsSync(join(dir, SIM_MODULE_PACKAGE, "manifest.json"))) return;
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`Couldn't download the sim module: ${response.status}`);
  const zip = Buffer.from(await response.arrayBuffer());
  const sha = createHash("sha256").update(zip).digest("hex");
  if (sha !== SHA256) throw new Error(`The sim module download doesn't match its checksum (${sha})`);

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const archive = join(dir, "module.zip");
  writeFileSync(archive, zip);
  // The desktop app only builds on Windows, where PowerShell can unzip.
  const unzip = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${dir}' -Force`],
    { stdio: "inherit" },
  );
  rmSync(archive);
  if (unzip.status !== 0) throw new Error("Couldn't unzip the sim module");
}
