import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, win32 } from "node:path";
import type { RecvSystemState, SimConnectConnection } from "node-simconnect";
import { REQUEST } from "../sim-ids.js";
import { findInPackages, type MsfsFolders } from "../msfs-paths.js";

// The flight a co-pilot spawns into. A sim's saved flight carries the whole aircraft state (switches, systems and,
// for the A32NX, 1,600 of its own variables), and loading another sim's state breaks complex aircraft: switches
// stop animating, ground power never connects. Dropping the state isn't enough either: the A32NX then has its gear
// lever variable at 0 and raises the gear on the ground. So the spawn file is the host's flight (aircraft, livery,
// position, parking, time, weather, fuel, payload) with the aircraft's state taken from the co-pilot's own copy of
// the aircraft: the state file it ships for that start (apron.flt at a gate), as MSFS uses for any new flight.

const FOLDER = join(tmpdir(), "airspace");
const SAVE_TIMEOUT_MS = 10_000;

// Sections describing the aircraft's own state, always taken from the aircraft's state file.
const STATE_SECTIONS = new Set([
  "LocalVars.0",
  "InteractivePoints.0",
  "Switches.0",
  "Electrical.0",
  "Systems.0",
  "AutoPilot.0",
  "Gauges.0",
  "Avionics.0",
  "BleedAir.0",
  "Controls.0",
]);
// What's loaded stays the host's, though state files carry it too.
const HOST_LOAD = new Set(["FuelSystem.0", "Payload.0"]);
const isState = (name: string): boolean => STATE_SECTIONS.has(name) || name.startsWith("Engine Parameters.");

// The state file an aircraft ships for each way a flight can start; a gate is the fallback.
const STATE_FILES = new Map([
  ["PREFLIGHT_GATE", "apron"],
  ["PREFLIGHT_PUSHBACK", "apron"],
  ["PREFLIGHT_TAXI", "taxi"],
  ["PREFLIGHT_HOLDSHORT", "runway"],
  ["TAKEOFF", "runway"],
  ["CLIMB", "climb"],
  ["CRUISE", "cruise"],
  ["DESCENT", "approach"],
  ["APPROACH", "approach"],
  ["FINAL", "final"],
  ["LANDING", "final"],
]);

interface Section {
  name: string;
  lines: string[];
}

/** .FLT files are latin-1 text; reading and writing them as latin-1 keeps every byte. */
function parse(text: string): Section[] {
  const sections: Section[] = [];
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    const header = /^\[(.+)\]\s*$/.exec(line);
    if (header?.[1] !== undefined) sections.push({ name: header[1], lines: [line] });
    else sections.at(-1)?.lines.push(line);
  }
  return sections;
}

const render = (sections: readonly Section[]): string => sections.flatMap((section) => section.lines).join("\r\n");

function value(sections: readonly Section[], section: string, key: string): string | undefined {
  const lines = sections.find((candidate) => candidate.name === section)?.lines ?? [];
  for (const line of lines) {
    const match = new RegExp(`^${key}\\s*=\\s*(.*)$`, "i").exec(line);
    if (match?.[1] !== undefined) return match[1].trim();
  }
  return undefined;
}

/** Calls `check` every `intervalMs` until it returns something or `timeoutMs` passes. */
function poll<T>(check: () => T | undefined, timeoutMs: number, intervalMs: number): Promise<T | undefined> {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const result = check();
      if (result !== undefined || Date.now() - started > timeoutMs) resolve(result);
      else setTimeout(tick, intervalMs);
    };
    tick();
  });
}

/** Saves the user's current flight and returns its text. */
export async function saveFlight(handle: SimConnectConnection): Promise<string> {
  mkdirSync(FOLDER, { recursive: true });
  const name = `host-${Date.now()}`;
  handle.flightSave(join(FOLDER, name), "Airspace co-op", "The host's flight for a co-pilot", 0);
  // MSFS writes NAME.FLT (and NAME.SPB) a moment after the call.
  const file = await poll(
    () => readdirSync(FOLDER).find((entry) => entry.toLowerCase() === `${name.toLowerCase()}.flt`),
    SAVE_TIMEOUT_MS,
    200,
  );
  if (file === undefined) throw new Error("Flight Simulator didn't save the flight");
  // Give it a moment to finish writing.
  await poll(() => undefined, 300, 300);
  const text = readFileSync(join(FOLDER, file), "latin1");
  for (const entry of readdirSync(FOLDER)) if (entry.startsWith(name)) rmSync(join(FOLDER, entry));
  return text;
}

/** The loaded aircraft's aircraft.cfg path inside its package, from the AircraftLoaded system state. */
export function loadedAircraftPath(handle: SimConnectConnection): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Flight Simulator didn't say which aircraft is loaded"));
    }, 3_000);
    const onState = (state: RecvSystemState) => {
      if (state.requestID !== REQUEST.aircraftLoaded) return;
      clearTimeout(timer);
      handle.off("systemState", onState);
      resolve(state.dataString);
    };
    handle.on("systemState", onState);
    handle.requestSystemState(REQUEST.aircraftLoaded, "AircraftLoaded");
  });
}

/**
 * The aircraft's folders inside its package, livery first: a livery's aircraft.cfg names its base aircraft with
 * `base_container`, and the base holds the state files and cameras. Paths are relative to a package.
 */
export function aircraftPaths(folders: MsfsFolders, aircraftPath: string): string[] {
  const cfg = findInPackages(folders, aircraftPath);
  if (cfg === undefined) return [aircraftPath];
  const base = /^\s*base_container\s*=\s*"?([^"\r\n;]+)"?/im.exec(readFileSync(cfg, "latin1"))?.[1]?.trim();
  if (base === undefined) return [aircraftPath];
  const baseFolder = win32.normalize(win32.join(win32.dirname(aircraftPath), base));
  return [aircraftPath, win32.join(baseFolder, "aircraft.cfg")];
}

export type SpawnFile = { flt: string } | { missing: string };

/** Builds the co-pilot's spawn file from the host's flight and the co-pilot's own aircraft. */
export function composeSpawnFlight(folders: MsfsFolders, hostFlt: string, paths: readonly string[]): SpawnFile {
  const host = parse(hostFlt);
  const title = value(host, "Sim.0", "Sim") ?? "the host's aircraft";
  const installed = paths.flatMap((path) => {
    const cfg = findInPackages(folders, path);
    return cfg === undefined ? [] : [dirname(cfg)];
  });
  if (installed.length === 0) return { missing: title };

  const stateName = STATE_FILES.get(value(host, "FreeFlight", "FirstFlightState") ?? "") ?? "apron";
  const statePath = [stateName, "apron"]
    .flatMap((name) => installed.map((dir) => stateFile(dir, name)))
    .find((path) => path !== undefined);
  const state = statePath === undefined ? [] : parse(readFileSync(statePath, "latin1"));

  const sections = [
    ...host.filter((section) => !isState(section.name) || state.length === 0),
    ...state.filter((section) => isState(section.name) && !HOST_LOAD.has(section.name)),
  ];
  return { flt: render(withTitle(sections, installed, title)) };
}

function stateFile(dir: string, name: string): string | undefined {
  const file = readdirSync(dir).find((entry) => entry.toLowerCase() === `${name}.flt`);
  return file === undefined ? undefined : join(dir, file);
}

/** Keeps the host's livery when the co-pilot has it, else the first livery of the aircraft they have. */
function withTitle(sections: Section[], installed: readonly string[], title: string): Section[] {
  const titles = installed.flatMap((dir) => liveryTitles(join(dir, "aircraft.cfg")));
  const chosen = titles.includes(title) ? title : titles.at(0);
  if (chosen === undefined || chosen === title) return sections;
  return sections.map((section) =>
    section.name === "Sim.0"
      ? { ...section, lines: section.lines.map((line) => (/^Sim\s*=/i.test(line) ? `Sim=${chosen}` : line)) }
      : section,
  );
}

function liveryTitles(cfg: string): string[] {
  if (!existsSync(cfg)) return [];
  return [...readFileSync(cfg, "latin1").matchAll(/^\s*title\s*=\s*"?([^"\r\n;]+)"?/gim)].map((match) =>
    match[1].trim(),
  );
}

/** Writes the spawn file and loads it. At the main menu MSFS applies it when the World Map opens. */
export function loadFlight(handle: SimConnectConnection, flt: string): void {
  mkdirSync(FOLDER, { recursive: true });
  const path = join(FOLDER, "spawn.flt");
  writeFileSync(path, flt, "latin1");
  handle.flightLoad(path);
}
