import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isStoredValues, type MenuLink, type StoredValues } from "./menu.js";

// The account an aircraft downloads flight plans with (the A32NX's SimBrief ID, kept in the sim's stored data). Each
// sim downloads its own uplink, so a mirrored INIT REQUEST only loads the captain's plan if the co-pilot's sim asks
// for the captain's account. The co-pilot borrows it while spawning (through the main menu, before the aircraft
// loads). Once the session ends their own values are put back through the main menu, now or the next time it opens;
// they're kept in a file until then so a closed app doesn't lose them.

const RESTORE_FILE = join(process.env.APPDATA ?? tmpdir(), "Airspace", "borrowed-flight-plan-account.json");

export interface AccountKeeper {
  /** Our own values for `keys`, as read the last time the main menu was open. */
  own(keys: readonly string[]): StoredValues;
  /** Uses the captain's values for the co-op session; false when the main menu isn't open to write them. */
  borrow(values: StoredValues): Promise<boolean>;
  /** The session ended: our own values go back now if the main menu is open, else the next time it opens. */
  release(): void;
}

function savedOriginals(): StoredValues | undefined {
  if (!existsSync(RESTORE_FILE)) return undefined;
  try {
    const json: unknown = JSON.parse(readFileSync(RESTORE_FILE, "utf8"));
    return isStoredValues(json) ? json : undefined;
  } catch {
    return undefined;
  }
}

let keeper: AccountKeeper | undefined;

/** The one account keeper for the app; `keys` are every profile's flight-plan account keys. */
export function accountKeeper(menu: MenuLink, keys: readonly string[]): AccountKeeper {
  keeper ??= startKeeper(menu, keys);
  return keeper;
}

function startKeeper(menu: MenuLink, keys: readonly string[]): AccountKeeper {
  let own: StoredValues = {};
  let atMainMenu = false;
  // While borrowing, the main menu opening (MSFS reloads it around a flight) mustn't put our own values back.
  let borrowing = false;

  const restore = async () => {
    const originals = savedOriginals();
    if (originals === undefined || !(await menu.write(originals))) return;
    rmSync(RESTORE_FILE, { force: true });
    console.log("Put back this sim's own SimBrief account");
  };

  // Each time the main menu opens: put back anything borrowed in an earlier session, then remember our own values.
  const onMainMenu = async () => {
    if (!borrowing) await restore();
    if (borrowing) return;
    own = (await menu.read(keys)) ?? own;
    const known = Object.values(own).some((value) => value !== null && value !== "");
    console.log(known ? "Read this sim's SimBrief account" : "No SimBrief account set in this sim");
  };
  menu.onChange(() => {
    const opened = menu.has("main-menu") && !atMainMenu;
    atMainMenu = menu.has("main-menu");
    if (opened) void onMainMenu();
  });

  return {
    own: (wanted) => Object.fromEntries(wanted.map((key) => [key, own[key] ?? null])),
    async borrow(values) {
      // Keep the first originals: borrowing twice must not save the captain's values as ours.
      if (savedOriginals() === undefined) {
        const originals = await menu.read(Object.keys(values));
        if (originals === undefined) return false;
        mkdirSync(dirname(RESTORE_FILE), { recursive: true });
        writeFileSync(RESTORE_FILE, JSON.stringify(originals));
      }
      borrowing = true;
      return menu.write(values);
    },
    release() {
      if (!borrowing) return;
      borrowing = false;
      if (menu.has("main-menu")) void restore();
    },
  };
}
