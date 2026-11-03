import {
  custom,
  event,
  family,
  lvar,
  toDatum,
  toggle,
  type Action,
  type Area,
  type Control,
  type Datum,
} from "../profile.js";

// The FCU and EFIS panels (ModelBehaviorDefs/A32NX/generated/A32NX_Interior_{FCU,EFIS,Autopilot}.xml). Their knobs and
// buttons fire A32NX.* events that fbw.wasm subscribes to without masking, so they're seen here as well. Knob turns
// aren't replayed: the FCU's displayed targets sync as values. Pushes and pulls are replayed as actions, because the
// managed dots miss most of them (pulling ALT in ALT mode, HDG out of RWY TRK); only SPD syncs through its dot, which
// shows every push and pull that does something. An event watched as an action must never be sent by a control's
// write, or the other side would see the write as a press and send it back.

type Side = "L" | "R";

// What FlyByWire converts inHg to hPa with (FlyByWireInterface.cpp, 541.822186666672 / 16).
const HPA_PER_INHG = 33.863886666667;

const afs = (name: string): Datum => lvar(`A32NX_FCU_AFS_DISPLAY_${name}`);

// The FCU shows inHg (always under 100) or hPa; the value alone says which.
const toHpa = (baro: number): number => (baro < 100 ? baro * HPA_PER_INHG : baro);

export const glareshieldAux = {
  "fcu.spdDashes": afs("SPD_MACH_DASHES"),
  "fcu.hdgDashes": afs("HDG_TRK_DASHES"),
  "fcu.vsDashes": afs("VS_FPA_DASHES"),
} satisfies Record<string, Datum>;

// A SET is read in the unit the FCU shows, so a value in the other unit (sent mid-way through a SPD/MACH or HDG-V/S
// change) is dropped: the FCU converts its own target when its mode follows.
const speedSet = custom((value, sim) => {
  // Selected speeds never go below 100 kt and Mach never reaches 1.
  const mach = value < 10;
  if (mach !== (sim.value("fcu.machMode") === 1)) return;
  sim.event("A32NX.FCU_SPD_SET", Math.round(mach ? value * 100 : value));
});

const verticalSet = custom((value, sim) => {
  // V/S moves in 100 ft/min steps and FPA stays within 9.9°, so only zero reads the same in both. FPA -0.1° comes out
  // as -1, which the FCU takes as "no value": that one setting doesn't sync.
  const fpaMode = sim.value("fcu.trkFpa") === 1;
  if (value !== 0 && Math.abs(value) < 10 !== fpaMode) return;
  sim.event("A32NX.FCU_VS_SET", Math.round(fpaMode ? value * 10 : value));
});

const fcu: Control[] = [
  {
    key: "fcu.altIncrement",
    read: lvar("A32NX_FCU_ALT_INCREMENT_1000"),
    write: toDatum(),
  },
  {
    key: "fcu.trkFpa",
    read: afs("TRK_FPA_MODE"),
    write: toggle("A32NX.FCU_TRK_FPA_TOGGLE_PUSH"),
  },
  {
    key: "fcu.spdManaged",
    read: afs("SPD_MACH_MANAGED"),
    write: custom((value, sim) => {
      if (sim.value("fcu.spdManaged") === value) return;
      sim.event(value === 1 ? "A32NX.FCU_SPD_PUSH" : "A32NX.FCU_SPD_PULL");
    }),
  },
  {
    key: "fcu.machMode",
    read: afs("MACH_MODE"),
    write: toggle("A32NX.FCU_SPD_MACH_TOGGLE_PUSH"),
    // In managed speed the FMGC switches to Mach itself, on each side at its own moment.
    only: { key: "fcu.spdManaged", equals: 0 },
  },
  {
    key: "fcu.spd",
    read: afs("SPD_MACH_VALUE"),
    write: speedSet,
    only: { key: "fcu.spdDashes", equals: 0 },
    tolerance: 0.004,
    rateHz: 10,
  },
  {
    key: "fcu.hdg",
    read: afs("HDG_TRK_VALUE"),
    write: event("A32NX.FCU_HDG_SET"),
    only: { key: "fcu.hdgDashes", equals: 0 },
    tolerance: 0.5,
    rateHz: 10,
  },
  {
    // The FCU rounds a SET to its current increment, so a 12,500 ft target lands on 13,000 while the other side's
    // switch is at 1000.
    key: "fcu.alt",
    read: afs("ALT_VALUE"),
    write: event("A32NX.FCU_ALT_SET"),
    tolerance: 50,
    rateHz: 10,
  },
  {
    key: "fcu.vs",
    read: afs("VS_FPA_VALUE"),
    write: verticalSet,
    only: { key: "fcu.vsDashes", equals: 0 },
    tolerance: 0.05,
    rateHz: 10,
  },
];

function glareshieldSide(side: Side): Control[] {
  const key = (thing: string) => `efis.${side.toLowerCase()}.${thing}`;
  const panel = (name: string) => lvar(`A32NX_FCU_EFIS_${side}_${name}`);
  const baroMode = key("baroMode");

  return [
    {
      key: key("mode"),
      read: panel("EFIS_MODE"),
      write: toDatum(),
    },
    {
      key: key("range"),
      read: panel("EFIS_RANGE"),
      write: toDatum(),
    },
    // 1 is ADF and 2 VOR, as the switch's own positions write them.
    ...family([1, 2], (index) => ({
      key: key(`navaid${index}`),
      read: panel(`NAVAID_${index}_MODE`),
      write: toDatum(),
    })),
    {
      key: key("baroInHg"),
      read: panel("BARO_IS_INHG"),
      write: toDatum(),
    },
    {
      // 0 STD, 1 QNH, 2 QFE. Pulling always selects STD; pushing leaves STD, or swaps QNH and QFE outside it.
      key: baroMode,
      read: panel("DISPLAY_BARO_MODE"),
      write: custom((value, sim) => {
        const current = sim.value(baroMode);
        if (current === undefined || current === value) return;
        sim.event(`A32NX.FCU_EFIS_${side}_BARO_${value === 0 ? "PULL" : "PUSH"}`);
      }),
    },
    {
      key: key("baro"),
      read: panel("DISPLAY_BARO_VALUE"),
      write: custom((value, sim) => {
        // 0 while the panel shows STD.
        if (value <= 0) return;
        sim.event(`A32NX.FCU_EFIS_${side}_BARO_SET`, Math.round(toHpa(value) * 16));
      }),
      tolerance: 0.005,
      rateHz: 10,
    },
    // Held while pressed (MASTERAWARN is FlyByWire's spelling); the warning system acknowledges on the press.
    ...family(
      [
        { thing: "masterWarning", name: "MASTERAWARN" },
        { thing: "masterCaution", name: "MASTERCAUT" },
      ],
      ({ thing, name }) => ({
        key: key(thing),
        read: lvar(`PUSH_AUTOPILOT_${name}_${side}`),
        write: toDatum(),
        kind: "momentary",
      }),
    ),
  ];
}

export const glareshieldAreas: Area[] = [
  { name: "FCU", controls: fcu },
  { name: "Captain's glareshield", controls: glareshieldSide("L") },
  { name: "First officer's glareshield", controls: glareshieldSide("R") },
];

const FCU_PRESSES = {
  ap1: "AP_1_PUSH",
  ap2: "AP_2_PUSH",
  athr: "ATHR_PUSH",
  loc: "LOC_PUSH",
  appr: "APPR_PUSH",
  exped: "EXPED_PUSH",
  apDisconnect: "AP_DISCONNECT_PUSH",
  athrDisconnect: "ATHR_DISCONNECT_PUSH",
  hdgPush: "HDG_PUSH",
  hdgPull: "HDG_PULL",
  altPush: "ALT_PUSH",
  altPull: "ALT_PULL",
  vsPush: "VS_PUSH",
  vsPull: "VS_PULL",
  // Its state only travels inside an ARINC 429 word (FCU discrete word 1, bit 20); L:A32NX_METRIC_ALT_TOGGLE is stale.
  metricAlt: "METRIC_ALT_TOGGLE_PUSH",
};

// FD and LS have lights, but the FCU also switches the FDs by itself (fd_auto_activate), so a press is replayed
// rather than its light matched. The filters (CSTR to ARPT) are one radio group.
const EFIS_PRESSES = { fd: "FD", ls: "LS", cstr: "CSTR", wpt: "WPT", vord: "VORD", ndb: "NDB", arpt: "ARPT" };

const efisActions = (side: Side): Action[] => {
  const prefix = `efis.${side.toLowerCase()}`;
  return [
    ...Object.entries(EFIS_PRESSES).map(([thing, name]) => ({
      key: `${prefix}.${thing}`,
      event: `A32NX.FCU_EFIS_${side}_${name}_PUSH`,
    })),
    // The cockpit's chrono button fires H:A32NX_EFIS_{side}_CHRONO_PUSHED, which SimConnect can't see; this event
    // (which fbw.wasm turns into that H:event) catches presses from bindings and replays any press.
    { key: `${prefix}.chrono`, event: `A32NX.EFIS_${side}_CHRONO_PUSHED` },
  ];
};

export const glareshieldActions: Action[] = [
  ...Object.entries(FCU_PRESSES).map(([thing, name]) => ({ key: `fcu.${thing}`, event: `A32NX.FCU_${name}` })),
  ...efisActions("L"),
  ...efisActions("R"),
];
