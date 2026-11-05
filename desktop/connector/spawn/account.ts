import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isStoredValues, type MenuLink, type StoredValues } from "./menu.js";

// The account an aircraft downloads flight plans with (the A32NX's SimBrief ID, kept in the sim's stored data). Each
// sim downloads its own uplink, so a mirrored INIT REQUEST only loads the captain's plan if the co-pilot's sim asks
// for the captain's account. The co-pilot borrows it while spawning (through the main menu, before the aircraft
// loads); their own values are put back the next time their main menu opens, and are kept in a file until then so a
// closed app doesn't lose them.

const RESTORE_FILE = join(process.env.APPDATA ?? tmpdir(), "Airspace", "borrowed-flight-plan-account.json");

export interface AccountKeeper {
  /** Our own values for `keys`, as read the last time the main menu was open. */
  own(keys: readonly string[]): StoredValues;
  /** Uses the captain's values until our main menu opens again; false when the main menu isn't open to write them. */
  borrow(values: StoredValues): Promise<boolean>;
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

  // Each time the main menu opens: put back anything borrowed, then remember our own values.
  const onMainMenu = async () => {
    const originals = savedOriginals();
    if (originals !== undefined && (await menu.write(originals))) {
      rmSync(RESTORE_FILE, { force: true });
      console.log("Put back this sim's own flight-plan account");
    }
    own = (await menu.read(keys)) ?? own;
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
      return menu.write(values);
    },
  };
}
