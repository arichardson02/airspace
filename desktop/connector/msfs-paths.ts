import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Where MSFS 2020 keeps its packages. Community and Official come from UserCfg.opt's InstalledPackagesPath; the core
// packages (the menus' pages) sit with the game itself: under XboxGames for the Microsoft Store install, under the
// Steam library for Steam.

export interface MsfsFolders {
  community: string;
  /** Official packages: `Official/OneStore` (Store) or `Official/Steam`. */
  official: string;
  /** The game's core packages, when found. */
  core?: string;
}

// UserCfg.opt for the Microsoft Store and Steam installs.
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

const DRIVES = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function msfsFolders(): MsfsFolders | undefined {
  for (const config of USER_CONFIGS) {
    if (!existsSync(config)) continue;
    const match = /^InstalledPackagesPath\s+"(.+)"\s*$/m.exec(readFileSync(config, "utf8"));
    const root = match?.[1];
    if (root === undefined) continue;
    const official = ["OneStore", "Steam"].map((name) => join(root, "Official", name)).find((dir) => existsSync(dir));
    const core = coreFolder();
    const folders = { community: join(root, "Community"), official: official ?? join(root, "Official", "OneStore") };
    return core === undefined ? folders : { ...folders, core };
  }
  return undefined;
}

function coreFolder(): string | undefined {
  const store = DRIVES.map((drive) => `${drive}:\\XboxGames\\Microsoft Flight Simulator\\Content\\Packages`);
  const steam = steamLibraries().map((library) =>
    join(library, "steamapps", "common", "MicrosoftFlightSimulator", "Packages"),
  );
  return [...store, ...steam].find((dir) => existsSync(join(dir, "fs-base-ui")));
}

function steamLibraries(): string[] {
  const vdf = "C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf";
  if (!existsSync(vdf)) return [];
  return [...readFileSync(vdf, "utf8").matchAll(/"path"\s+"(.+?)"/g)].map((match) => match[1].replaceAll("\\\\", "\\"));
}

/** The first Community or Official package that has `relative` (a path inside a package), as a full path. */
export function findInPackages(folders: MsfsFolders, relative: string): string | undefined {
  for (const root of [folders.community, folders.official]) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(root, entry.name, relative);
      if (existsSync(path)) return path;
    }
  }
  return undefined;
}
