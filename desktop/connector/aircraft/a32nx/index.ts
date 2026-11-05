import { lvar, type AircraftProfile } from "../profile.js";
import { flightControls } from "./flight-controls.js";
import { glareshieldActions, glareshieldAreas, glareshieldAux } from "./glareshield.js";
import { flypadAreas } from "./flypad.js";
import { handlingAreas } from "./handling.js";
import { mcdu } from "./mcdu.js";
import { overheadAreas } from "./overhead.js";
import { pedestalActions, pedestalAreas, pedestalAux } from "./pedestal.js";

// FlyByWire's A320neo (A32NX) for MSFS 2020, mapped from FlyByWire's flight deck API docs and the cockpit behaviour
// files in the aircraft package (ModelBehaviorDefs/A32NX/generated/A32NX_Interior_*.xml). Sync only what the pilot
// touches; every system's effects are computed by each sim.

const edition = lvar("FBW_BUILD_EDITION");
const ready = lvar("A32NX_IS_READY");

export const a32nx: AircraftProfile = {
  id: "fbw-a32nx",
  version: 3,
  name: "A320neo (FlyByWire)",
  identity: [edition, ready],
  // Liveries set their own titles and SimObjects folders, so the ATC model and FlyByWire's own variables decide.
  matches: (identity) =>
    identity.atcModel.includes("A20N") &&
    (identity.values.get(edition.name) ?? 0) > 0 &&
    identity.values.get(ready.name) === 1,
  // Power-up order: the overhead brings power and air, then the glareshield and pedestal come alive.
  areas: [...flypadAreas, ...overheadAreas, ...glareshieldAreas, ...pedestalAreas, ...handlingAreas],
  aux: { ...glareshieldAux, ...pedestalAux },
  actions: [...glareshieldActions, ...pedestalActions],
  flightControls,
  fms: mcdu,
  // The INIT uplink asks SimBrief for this pilot ID first, else the Navigraph username's latest plan.
  flightPlanAccount: ["A32NX_CONFIG_OVERRIDE_SIMBRIEF_USERID", "A32NX_NAVIGRAPH_USERNAME"],
};
