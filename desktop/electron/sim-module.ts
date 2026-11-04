import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { msfsFolders } from "../connector/msfs-paths.js";

// Installs what the app needs inside the simulator into its Community folder: the in-sim module (MobiFlight's WASM
// module, bundled with the app) so the connector can press cockpit buttons only in-sim code can reach, and the menu
// package (desktop/sim-package) that lets it drive the menus. MSFS loads packages at start, so a first install or a
// change takes effect after the sim restarts.

const PACKAGE = "mobiflight-event-module";

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
  const community = msfsFolders()?.community;
  if (!existsSync(source) || community === undefined || !existsSync(community)) return;
  const target = join(community, PACKAGE);
  if (existsSync(join(target, "manifest.json")) && !newer(packageVersion(source), packageVersion(target))) return;
  cpSync(source, target, { recursive: true, force: true });
}

// The menu package: copies of three of the game's menu pages with our script added. They're rebuilt from the
// player's own game files every launch, so a sim update that changes a page is picked up instead of hidden.
const MENU_PACKAGE = "airspace-menu";
const MENU_SCRIPT = "html_ui/Pages/Airspace/airspace-menu.js";
const MENU_SCRIPT_TAG = '    <script type="text/javascript" src="/Pages/Airspace/airspace-menu.js"></script>\n';
const MENU_PAGES: readonly { source: "core" | "official"; pkg: string; page: string }[] = [
  { source: "core", pkg: "fs-base-onboarding", page: "html_ui/Pages/FlowBar/FlowBarPage.html" },
  { source: "official", pkg: "fs-base-ui-pages", page: "html_ui/Pages/FlightPlanning/FlightPlanningPage.html" },
  { source: "official", pkg: "fs-base-ui-pages", page: "html_ui/Pages/MissionStartup/MissionStartup.html" },
];
const MENU_MANIFEST = {
  dependencies: [],
  content_type: "MISC",
  title: "Airspace menu link",
  manufacturer: "",
  creator: "Airspace",
  package_version: "1.0.0",
  minimum_game_version: "1.37.19",
  release_notes: { neutral: { LastUpdate: "", OlderHistory: "" } },
};
// Windows file times count 100 ns ticks from 1601; MSFS's layout.json uses them.
const FILETIME_EPOCH_S = 11_644_473_600;

/** Writes the menu package from `script` and the game's own pages, when anything in it changed. */
export function installMenuPackage(script: string): void {
  const folders = msfsFolders();
  if (folders === undefined || !existsSync(folders.community) || !existsSync(script)) return;
  const files = new Map<string, string>([[MENU_SCRIPT, readFileSync(script, "utf8")]]);
  for (const { source, pkg, page } of MENU_PAGES) {
    const root = source === "core" ? folders.core : folders.official;
    const original = root === undefined ? undefined : join(root, pkg, page);
    if (original === undefined || !existsSync(original)) continue;
    // Asobo's pages start with a byte-order mark.
    const html = readFileSync(original, "utf8").replace(/^﻿/, "");
    if (html.includes("</head>")) files.set(page, html.replace("</head>", `${MENU_SCRIPT_TAG}</head>`));
  }
  files.set("manifest.json", JSON.stringify(MENU_MANIFEST, null, 2));

  const target = join(folders.community, MENU_PACKAGE);
  const current = (path: string) => (existsSync(join(target, path)) ? readFileSync(join(target, path), "utf8") : "");
  if ([...files].every(([path, content]) => current(path) === content)) return;
  for (const [path, content] of files) {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), content);
  }
  const content = [...files.keys()]
    .filter((path) => path !== "manifest.json")
    .map((path) => {
      const stat = statSync(join(target, path));
      return { path, size: stat.size, date: Math.round((stat.mtimeMs / 1000 + FILETIME_EPOCH_S) * 10_000_000) };
    });
  writeFileSync(join(target, "layout.json"), JSON.stringify({ content }, null, 2));
}
