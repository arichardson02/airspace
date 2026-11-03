import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Installs the in-sim module (MobiFlight's WASM module, bundled with the app) into the simulator's Community folder,
// so the connector can press cockpit buttons only in-sim code can reach. A pilot's own copy is left alone unless
// ours is newer. MSFS loads packages at start, so a first install takes effect after the sim restarts.

const PACKAGE = "mobiflight-event-module";

// Where MSFS 2020 keeps UserCfg.opt, which names the packages folder: the Microsoft Store and Steam installs.
const USER_CONFIGS = [
  join(
    process.env.LOCALAPPDATA ?? "",
    "Packages",
    "Microsoft.FlightSimulator_8wekyb3d8bbwe",
    "LocalCache",
    "UserCfg.opt",
  ),
  join(process.env.APPDATA ?? "", "Microsoft Flight Simulator", "UserCfg.opt"),
];

function communityFolder(): string | undefined {
  for (const config of USER_CONFIGS) {
    if (!existsSync(config)) continue;
    const match = /^InstalledPackagesPath\s+"(.+)"\s*$/m.exec(readFileSync(config, "utf8"));
    if (match?.[1] !== undefined) return join(match[1], "Community");
  }
  return undefined;
}

/** A package's version from its manifest, as comparable numbers. */
function packageVersion(dir: string): number[] {
  const match = /"package_version"\s*:\s*"([\d.]+)"/.exec(readFileSync(join(dir, "manifest.json"), "utf8"));
  return (match?.[1] ?? "0").split(".").map((part) => Number(part));
}

function newer(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a.at(i) ?? 0) - (b.at(i) ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

/** Copies the bundled module into the Community folder when it's missing or older. */
export function installSimModule(resourcesPath: string): void {
  const source = join(resourcesPath, "sim-module", PACKAGE);
  const community = communityFolder();
  if (!existsSync(source) || community === undefined || !existsSync(community)) return;
  const target = join(community, PACKAGE);
  if (existsSync(join(target, "manifest.json")) && !newer(packageVersion(source), packageVersion(target))) return;
  cpSync(source, target, { recursive: true, force: true });
}
