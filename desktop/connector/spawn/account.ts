import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isStoredValues, type MenuLink, type StoredValues } from "./menu.js";

// Aircraft download their flight-plan uplink with a SimBrief pilot ID kept in the sim's stored data (the A32NX's
// flyPad setting), and each sim downloads its own. So a mirrored INIT REQUEST only loads the captain's plan if the
// co-pilot's sim asks with the captain's ID, which comes from the captain's Airspace account. The co-pilot's sim
// borrows it while spawning (through the main menu, before the aircraft loads). Once the session ends their own
// value is put back through the main menu, now or the next time it opens; it's kept in a file until then so a
// closed app doesn't lose it.

const RESTORE_FILE = join(process.env.APPDATA ?? tmpdir(), "Airspace", "borrowed-flight-plan-account.json");

export interface AccountKeeper {
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

/** The one account keeper for the app. */
export function accountKeeper(menu: MenuLink): AccountKeeper {
  keeper ??= startKeeper(menu);
  return keeper;
}

function startKeeper(menu: MenuLink): AccountKeeper {
  let atMainMenu = false;
  // While borrowing, the main menu opening (MSFS reloads it around a flight) mustn't put our own values back.
  let borrowing = false;

  const restore = async () => {
    const originals = savedOriginals();
    if (originals === undefined || !(await menu.write(originals))) return;
    rmSync(RESTORE_FILE, { force: true });
    console.log("Put back this sim's own SimBrief pilot ID");
  };

  // Each time the main menu opens, anything borrowed in an earlier session goes back.
  menu.onChange(() => {
    const opened = menu.has("main-menu") && !atMainMenu;
    atMainMenu = menu.has("main-menu");
    if (opened && !borrowing) void restore();
  });

  return {
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
