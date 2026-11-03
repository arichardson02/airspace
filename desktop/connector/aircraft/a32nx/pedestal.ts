import {
  custom,
  event,
  family,
  hEvent,
  lvar,
  simvar,
  toDatum,
  type Action,
  type Area,
  type Control,
  type Datum,
  type Write,
  type WriteContext,
} from "../profile.js";

// The pedestal behind the thrust levers: engine start, radios, transponder, ECAM control panel and the switches
// around them. Mapped from A32NX_INTERIOR.xml and ModelBehaviorDefs/A32NX (Airbus.xml, AirlinerCommon.xml,
// Interior/Pedestal/A32NX_ECP.xml, generated/A32NX_Interior_{Misc,RMP,ATC,Printer,Handling}.xml) in 2020.15.0, and
// FlyByWire's ECP, FakeDmc and RMP sources at that tag.

// How long an H:event button is held, as the cockpit's own press would.
const PRESS_MS = 150;
// An RMP's VOR/ILS/ADF buttons only work once its NAV button is in, so a mode press waits for a NAV press sent with it.
const RMP_MODE_SETTLE_MS = 300;

/** A switch whose L:var is its position, written directly by the cockpit's click code. */
const latched = (key: string, name: string): Control => ({ key, read: lvar(name), write: toDatum() });

/** A light potentiometer knob. Indices above 30 have no LIGHT_POTENTIOMETER_n_SET event, so they're set as the knob's
 * own code does, through the in-sim module. */
const potentiometer = (key: string, index: number): Control => ({
  key,
  read: simvar(`LIGHT POTENTIOMETER:${index}`, "percent"),
  write:
    index <= 30
      ? event(`LIGHT_POTENTIOMETER_${index}_SET`)
      : custom((value, sim) => {
          sim.calculator(`${Math.round(value)} ${index} (>K:2:LIGHT_POTENTIOMETER_SET)`);
        }),
  tolerance: 1,
  rateHz: 5,
});

/** Presses and releases one ECP key, the only input the ECP reads (`H:A32NX_ECP_<NAME>_PRESSED/_RELEASED`). */
const pressEcpKey = (sim: WriteContext, name: string): void => {
  sim.calculator(`(>H:A32NX_ECP_${name}_PRESSED)`);
  setTimeout(() => {
    sim.calculator(`(>H:A32NX_ECP_${name}_RELEASED)`);
  }, PRESS_MS);
};

const ecpKeyWrite = (name: string): Write =>
  hEvent(`A32NX_ECP_${name}_PRESSED`, { release: `A32NX_ECP_${name}_RELEASED` });

// ---- Engine start ----

const engineModeSelector = lvar("XMLVAR_ENG_MODE_SEL");
const engines: readonly (1 | 2)[] = [1, 2];

const engineArea: Area = {
  name: "Engine start",
  controls: [
    // The master switch is the fuel valve's switch: the click sends FUELSYSTEM_VALVE_OPEN/CLOSE with the valve.
    ...family(engines, (engine) => ({
      key: `ped.eng.master${engine}`,
      read: simvar(`FUELSYSTEM VALVE SWITCH:${engine}`, "bool"),
      write: custom((value, sim) => {
        sim.event(value >= 0.5 ? "FUELSYSTEM_VALVE_OPEN" : "FUELSYSTEM_VALVE_CLOSE", engine);
      }),
    })),
    // The knob's position lives in its own L:var and each click also sets the ignition switches, so both are set
    // here: 0 CRANK, 1 NORM, 2 IGN/START (which also brings up the ENG page, as the knob does).
    {
      key: "ped.eng.modeSelector",
      read: engineModeSelector,
      write: custom((value, sim) => {
        const position = Math.round(value);
        sim.set(engineModeSelector, position);
        if (position === 0) {
          sim.event("TURBINE_IGNITION_SWITCH_SET", 0);
        } else {
          for (const engine of engines) sim.event(`TURBINE_IGNITION_SWITCH_SET${engine}`, position);
        }
        if (position === 2) sim.calculator("(>H:A320_Neo_EICAS_2_Ignition_Start)");
      }),
    },
  ],
};

// ---- Radio management panels ----

type RmpSide = "L" | "R";
const rmpSides: readonly RmpSide[] = ["L", "R"];
const vhfs: readonly (1 | 2 | 3)[] = [1, 2, 3];

const comEvent = (vhf: number, standby: boolean): string =>
  `COM${vhf === 1 ? "" : vhf}${standby ? "_STBY" : ""}_RADIO_SET_HZ`;

// The H:event each RMP mode is selected with, by L:A32NX_RMP_<side>_SELECTED_MODE value.
const rmpModeButtons: ReadonlyMap<number, string> = new Map([
  [1, "VHF1"],
  [2, "VHF2"],
  [3, "VHF3"],
  [6, "VOR"],
  [7, "ILS"],
  [8, "GLS"],
  [9, "MLS"],
  [10, "ADF"],
]);

// The RMP's NAV backup values, kept per panel in L:vars the RMP display reads.
const rmpNavValues: readonly [suffix: string, name: string][] = [
  ["vorActive", "SAVED_ACTIVE_FREQUENCY_VOR"],
  ["vorStandby", "SAVED_STANDBY_FREQUENCY_VOR"],
  ["vorCourse", "SAVED_COURSE_VOR"],
  ["ilsActive", "SAVED_ACTIVE_FREQUENCY_ILS"],
  ["ilsStandby", "SAVED_STANDBY_FREQUENCY_ILS"],
  ["ilsCourse", "SAVED_COURSE_ILS"],
  ["adfActive", "SAVED_ACTIVE_FREQUENCY_ADF"],
  ["adfStandby", "SAVED_STANDBY_FREQUENCY_ADF"],
];

/** A standby frequency as an RMP keeps it: its own VHF's in the sim radio, the others in the RMP's own L:var. */
const rmpStandby = (side: RmpSide, vhf: 1 | 2 | 3): Control => {
  const own = side === "L" ? 1 : 2;
  const key = `ped.rmp${side}.vhf${vhf}Standby`;
  return vhf === own
    ? { key, read: simvar(`COM STANDBY FREQUENCY:${vhf}`, "Hz"), write: event(comEvent(vhf, true)), rateHz: 5 }
    : { key, read: lvar(`A32NX_RMP_${side}_VHF${vhf}_STANDBY_FREQUENCY`), write: toDatum(), rateHz: 5 };
};

// The panel's knobs and buttons only fire H:events into the RMP instrument, so the values they change are synced,
// and its mode buttons (which also switch what the instrument shows) are pressed until the mode matches.
const rmpControls = (side: RmpSide): Control[] => {
  const prefix = `ped.rmp${side}`;
  const modeKey = `${prefix}.mode`;
  return [
    latched(`${prefix}.power`, `A32NX_RMP_${side}_TOGGLE_SWITCH`),
    latched(`${prefix}.navGuard`, `XMLVAR_RMP_${side}_NavLockOff`),
    {
      key: `${prefix}.nav`,
      read: lvar(`A32NX_RMP_${side}_NAV_BUTTON_SELECTED`),
      write: hEvent(`A32NX_RMP_${side}_NAV_BUTTON_PRESSED`, { whenDifferent: true }),
    },
    {
      key: modeKey,
      read: lvar(`A32NX_RMP_${side}_SELECTED_MODE`),
      write: custom((value, sim) => {
        const button = rmpModeButtons.get(Math.round(value));
        if (button === undefined) return;
        setTimeout(() => {
          if (sim.value(modeKey) !== value) sim.calculator(`(>H:A32NX_RMP_${side}_${button}_BUTTON_PRESSED)`);
        }, RMP_MODE_SETTLE_MS);
      }),
    },
    ...family(vhfs, (vhf) => rmpStandby(side, vhf)),
    ...family(rmpNavValues, ([suffix, name]) => ({
      ...latched(`${prefix}.${suffix}`, `A32NX_RMP_${side}_${name}`),
      rateHz: 5,
    })),
  ];
};

const rmpArea: Area = { name: "Radio management", controls: rmpSides.flatMap(rmpControls) };

// Both RMPs share the three VHF transceivers' active frequencies (the transfer key swaps them with standby).
const vhfArea: Area = {
  name: "VHF radios",
  controls: family(vhfs, (vhf) => ({
    key: `ped.radio.vhf${vhf}Active`,
    read: simvar(`COM ACTIVE FREQUENCY:${vhf}`, "Hz"),
    write: event(comEvent(vhf, false)),
  })),
};

// ---- Transponder and TCAS ----

// Every knob writes its L:var, and the panel's update loop sets TRANSPONDER STATE from them each frame.
const transponderArea: Area = {
  name: "Transponder",
  controls: [
    latched("ped.xpdr.mode", "A32NX_TRANSPONDER_MODE"),
    latched("ped.xpdr.system", "A32NX_TRANSPONDER_SYSTEM"),
    latched("ped.xpdr.altRptg", "A32NX_SWITCH_ATC_ALT"),
    // FlyByWire's docs call these read-only, but the knobs' templates write them directly.
    latched("ped.tcas.mode", "A32NX_SWITCH_TCAS_Position"),
    latched("ped.tcas.traffic", "A32NX_SWITCH_TCAS_Traffic_Position"),
    // The keypad's digits are H:events into the ATC panel; the code it sets is synced instead.
    { key: "ped.xpdr.code", read: simvar("TRANSPONDER CODE:1", "Bco16"), write: event("XPNDR_SET") },
  ],
};

// ---- ECAM control panel ----

// The ECP's keys only fire H:events. They're read from its hardwired discretes, the SD page and, for T.O CONFIG
// (which has no discrete), its bit in the warning switch word.

// L:A32NX_ECAM_SD_CURRENT_PAGE_INDEX value -> the key that selects it. FakeDmc toggles a page on its key's press:
// the shown page goes back to automatic (-1), any other is selected.
const sdPageKeys: ReadonlyMap<number, string> = new Map([
  [0, "ENG"],
  [1, "BLEED"],
  [2, "PRESS"],
  [3, "ELEC"],
  [4, "HYD"],
  [5, "FUEL"],
  [6, "APU"],
  [7, "COND"],
  [8, "DOOR"],
  [9, "BRAKES"],
  [10, "FLT_CTL"],
]);
const sdPageKey = "ecp.sdPage";

const ecpKey = (key: string, read: string, name: string): Control => ({
  key,
  read: lvar(read),
  write: ecpKeyWrite(name),
  kind: "momentary",
});

const ecpArea: Area = {
  name: "ECAM control panel",
  controls: [
    // The selected system page: pressing a page key selects it, pressing it again goes back to automatic. STS (12)
    // and the automatic CRZ page (11) are left to the STS key and each aircraft's own paging.
    {
      key: sdPageKey,
      read: lvar("A32NX_ECAM_SD_CURRENT_PAGE_INDEX"),
      write: custom((value, sim) => {
        const current = sim.value(sdPageKey);
        if (current === value) return;
        const name = sdPageKeys.get(Math.round(value)) ?? (value === -1 ? sdPageKeys.get(current ?? -1) : undefined);
        if (name !== undefined) pressEcpKey(sim, name);
      }),
    },
    // Hardwired discretes, set while the key is physically held.
    ecpKey("ecp.sts", "A32NX_ECP_DISCRETE_OUT_STS", "STS"),
    ecpKey("ecp.rcl", "A32NX_ECP_DISCRETE_OUT_RCL", "RCL"),
    // One discrete for both CLR keys, which do the same.
    ecpKey("ecp.clr", "A32NX_ECP_DISCRETE_OUT_CLR", "CLR_1"),
    ecpKey("ecp.emerCanc", "A32NX_ECP_DISCRETE_OUT_EMER_CANC", "EMER_CANCEL"),
    ecpKey("ecp.all", "A32NX_ECP_DISCRETE_OUT_ALL", "ALL"),
    { ...ecpKey("ecp.toConfig", "A32NX_ECP_WARNING_SWITCH_WORD", "TO_CONF_TEST"), arincBit: 18 },
    potentiometer("ecp.upperBrightness", 92),
    potentiometer("ecp.lowerBrightness", 93),
  ],
};

// ---- Switching panel, weather radar, lights, door, printer ----

// 0 CAPT, 1 NORM, 2 F/O.
const switchingKnobs: readonly [suffix: string, type: string][] = [
  ["attHdg", "ATT_HDG"],
  ["airData", "AIR_DATA"],
  ["eisDmc", "EIS_DMC"],
  ["ecamNdXfr", "ECAM_ND_XFR"],
];

const switchingArea: Area = {
  name: "Switching panel",
  controls: family(switchingKnobs, ([suffix, type]) =>
    latched(`ped.switching.${suffix}`, `A32NX_${type}_SWITCHING_KNOB`),
  ),
};

const weatherRadarArea: Area = {
  name: "Weather radar",
  controls: [
    // 0 SYS 1, 1 OFF, 2 SYS 2.
    latched("ped.wxr.system", "XMLVAR_A320_WeatherRadar_Sys"),
    // 0 WX, 1 WX+T, 2 TURB, 3 MAP.
    latched("ped.wxr.mode", "XMLVAR_A320_WeatherRadar_Mode"),
    latched("ped.wxr.pws", "A32NX_SWITCH_RADAR_PWS_Position"),
    latched("ped.wxr.multiscan", "A32NX_RADAR_MULTISCAN_AUTO"),
    latched("ped.wxr.gcs", "A32NX_RADAR_GCS_AUTO"),
  ],
};

const lightingArea: Area = {
  name: "Pedestal lighting",
  controls: [
    potentiometer("ped.lights.flood", 76),
    potentiometer("ped.lights.integ", 85),
    // The CONSOLE/FLOOR switches set their potentiometer to 100 (off), 50 (dim) or 0 (bright).
    potentiometer("ped.lights.consoleCapt", 8),
    potentiometer("ped.lights.consoleFo", 9),
  ],
};

// The lock switch springs back to NORM; the lock state it sets is what lasts.
const doorArea: Area = { name: "Cockpit door", controls: [latched("ped.door.lock", "A32NX_COCKPIT_DOOR_LOCKED")] };

const pagesPrinted = lvar("A32NX_PAGES_PRINTED");
const collectKey = "ped.printer.collect";

// Both MCDUs print the same pages; collecting, paging and discarding them are the pilot's.
const printerArea: Area = {
  name: "Printer",
  controls: [
    // Collecting the paper adds a page; the MCDU also adds one when it prints over uncollected paper, which both
    // aircraft do, so only a count ahead of ours is replayed as a collect.
    {
      key: collectKey,
      read: pagesPrinted,
      risingOnly: true,
      write: custom((value, sim) => {
        if ((sim.value(collectKey) ?? 0) >= value) return;
        sim.set(lvar("A32NX_PRINTER_PRINTING"), 0);
        sim.set(pagesPrinted, value);
        sim.set(lvar("A32NX_PRINT_PAGE_OFFSET"), 0);
      }),
    },
    latched("ped.printer.page", "A32NX_PRINT_PAGE_OFFSET"),
    // The printer clears it once the page is gone.
    { ...latched("ped.printer.discard", "A32NX_DISCARD_PAGE"), risingOnly: true },
  ],
};

export const pedestalAreas: Area[] = [
  engineArea,
  rmpArea,
  vhfArea,
  transponderArea,
  ecpArea,
  switchingArea,
  weatherRadarArea,
  lightingArea,
  doorArea,
  printerArea,
];

// The rudder trim knob springs back and sends these 40 times a second while held; each FAC trims from the events,
// so replaying them keeps both trims equal without syncing the trim position the rudder axis also moves.
export const pedestalActions: Action[] = [
  { key: "ped.xpdr.ident", event: "XPNDR_IDENT_ON" },
  { key: "ped.rudderTrim.left", event: "RUDDER_TRIM_LEFT" },
  { key: "ped.rudderTrim.right", event: "RUDDER_TRIM_RIGHT" },
  { key: "ped.rudderTrim.reset", event: "RUDDER_TRIM_RESET" },
];

export const pedestalAux = {} satisfies Record<string, Datum>;
