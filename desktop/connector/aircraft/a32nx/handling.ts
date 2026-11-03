import { event, lvar, simvar, toDatum, toggle, type Area, type Control } from "../profile.js";

// The levers and switches around the pedestal and the main panel's gear area, plus the payload. Mapped from
// ModelBehaviorDefs/A32NX/generated/A32NX_Interior_Handling.xml, the interior model's buttons, and FlyByWire's systems
// at v2020.15.0.

/** An L:var the cockpit only reads, so the other side's value is written straight into it. */
const direct = (key: string, name: string): Control => ({ key, read: lvar(name), write: toDatum() });

/** A button held through its L:var while pressed. */
const pressed = (key: string, name: string): Control => ({
  key,
  read: lvar(name),
  write: toDatum(),
  kind: "momentary",
});

// 0-4 (UP, 1, 2, 3, FULL). FlyByWire masks the FLAPS_* events and turns them into this.
const flaps = direct("hdl.flaps", "A32NX_FLAPS_HANDLE_INDEX");

// FlyByWire's spoilers handler keeps the lever's position and arming itself and rewrites both L:vars every frame, so
// they're set through its events.
const speedbrake: Control = {
  key: "hdl.speedbrake",
  // 0 retracted ... 1 full. A position above 0 disarms, as on the lever.
  read: lvar("A32NX_SPOILERS_HANDLE_POSITION"),
  write: event("SPOILERS_SET", { scale: 16_384 }),
  tolerance: 0.01,
  rateHz: 10,
};

const speedbrakeArmed: Control = {
  key: "hdl.speedbrakeArmed",
  read: lvar("A32NX_SPOILERS_ARMED"),
  // Arming also brings the lever to 0, so the two never fight whichever arrives first.
  write: event("SPOILERS_ARM_SET"),
};

// 1 down. FlyByWire masks the GEAR_* events and turns them into this.
const gearLever = direct("hdl.gearLever", "A32NX_GEAR_LEVER_POSITION_REQUEST");

// The gravity extension crank: the pilot unfolds the handle, then turns it up to three times. The cockpit animates
// A32NX_GRAVITYGEAR_ROTATE_PCT (what the gear system reads) toward the turns, so the pilot's turns are what syncs.
const gravityGearHandle = direct("hdl.gravityGear.handle", "A32NX_GRAVITYGEAR_TURNED");
const gravityGearTurns = direct("hdl.gravityGear.turns", "A32NX_GRAVITYGEAR_ROTATIONS");

const parkBrake = direct("hdl.parkBrake", "A32NX_PARK_BRAKE_LEVER_POS");

const autobrake: Control = {
  key: "hdl.autobrake",
  // 0 off, 1 LO, 2 MED, 3 MAX. The event's data goes straight into the requested mode (FlyByWire's events doc lists
  // 1-4, but autobrakes.rs passes it through unchanged).
  read: lvar("A32NX_AUTOBRAKES_ARMED_MODE"),
  write: event("A32NX.AUTOBRAKE_SET"),
};

const brakeFan = direct("hdl.brakeFan", "A32NX_BRAKE_FAN_BTN_PRESSED");

// The sidesticks' takeover buttons (which disconnect the autopilot) and the thrust levers' A/THR disconnect hold
// these while pressed instead of firing the FCU's disconnect events, so their presses are replayed by holding them.
const disconnects: Control[] = [
  ...["1", "2"].map((side) => pressed(`hdl.apDisconnect${side}`, `A32NX_PRIORITY_TAKEOVER:${side}`)),
  pressed("hdl.athrDisconnect", "A32NX_AUTOTHRUST_DISCONNECT"),
];

// A/SKID & N/W STRG: one switch for the anti-skid and the nose wheel steering. The sim keeps it and FlyByWire reads
// it, so it's flipped with the sim's own toggle.
const antiSkid: Control = {
  key: "hdl.antiSkid",
  read: simvar("ANTISKID BRAKES ACTIVE", "bool"),
  write: toggle("ANTISKID_BRAKES_TOGGLE"),
};

// FlyByWire's payload system owns PAYLOAD STATION WEIGHT:1-8: every frame it rewrites them from the passengers seated
// and cargo loaded, so a station weight written from outside reverts at once. The boarding state is what syncs:
// the seats taken, the cargo loaded and the flyPad's targets for both. Each sim then weighs its own stations the same.
// Only the side that pressed board runs the boarding (A32NX_BOARDING_STARTED_BY_USR isn't synced); the other follows
// its seats and cargo, so the two never seat passengers at random against each other.

/** A station's load and the flyPad's target for it, which FlyByWire names `<name>_DESIRED`. */
const loadAndTarget = (key: string, name: string): Control[] => [
  direct(key, name),
  direct(`${key}Target`, `${name}_DESIRED`),
];

// Passengers are one bit per seat (up to 48 in a station, exact in a double).
const cabins = ["A", "B", "C", "D"].flatMap((station) =>
  loadAndTarget(`hdl.payload.pax${station}`, `A32NX_PAX_${station}`),
);

// Kilograms. The docs shorten the forward hold to FWD_BAGGAGE; payload/mod.rs names it FWD_BAGGAGE_CONTAINER.
const holds = [
  { key: "fwdBaggage", name: "FWD_BAGGAGE_CONTAINER" },
  { key: "aftContainer", name: "AFT_CONTAINER" },
  { key: "aftBaggage", name: "AFT_BAGGAGE" },
  { key: "aftBulk", name: "AFT_BULK_LOOSE" },
].flatMap((hold) => loadAndTarget(`hdl.payload.${hold.key}`, `A32NX_CARGO_${hold.name}`));

// Kilograms. Each sim weighs its seated passengers with its own, so both need the same.
const perPassengerWeight = direct("hdl.payload.perPaxWeight", "A32NX_WB_PER_PAX_WEIGHT");

export const handlingAreas: Area[] = [
  { name: "Flaps and speedbrake", controls: [flaps, speedbrake, speedbrakeArmed] },
  {
    name: "Gear and brakes",
    controls: [gearLever, gravityGearHandle, gravityGearTurns, parkBrake, autobrake, brakeFan, antiSkid],
  },
  { name: "Disconnect buttons", controls: disconnects },
  { name: "Payload", controls: [perPassengerWeight, ...cabins, ...holds] },
];
