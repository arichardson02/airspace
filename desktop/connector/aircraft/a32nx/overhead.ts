import {
  custom,
  event,
  family,
  inputEvent,
  lvar,
  pulse,
  simvar,
  toDatum,
  toggle,
  type Area,
  type Control,
  type Datum,
  type Write,
} from "../profile.js";

// The overhead panel, mapped from the cockpit model's click code (SimObjects/.../model/A320_NEO_INTERIOR.xml and the
// templates in ModelBehaviorDefs/A32NX). Most pushbuttons toggle an L:var the systems read, so writing that L:var is
// the press. Lights go through Asobo's light templates, which keep the switch position in an L:var but only light the
// bulbs through events: those write the switch's input event when the sim lists it, or replay the click code.
// Multi-parameter events (K:2) can't go through SimConnect, so they run as calculator code in the sim.

const bool = (name: string): Datum => simvar(name, "bool");

/** A switch whose position is an L:var the click toggles directly. */
const lvarSwitch = (key: string, name: string): Control => ({ key, read: lvar(name), write: toDatum() });

const plain = (entries: readonly (readonly [key: string, name: string])[]): Control[] =>
  entries.map(([key, name]) => lvarSwitch(key, name));

/** A guarded button that latches for good (IDG disconnect, fire agents). */
const latch = (key: string, name: string): Control => ({ ...lvarSwitch(key, name), irreversible: true });

/** A held button that does something lasting on its first press (RAT MAN ON). */
const press = (key: string, name: string): Control => ({ ...latch(key, name), kind: "momentary" });

/** A rotary selector's detent: 0, 1 or 2. */
const detent = (value: number): number => Math.min(2, Math.max(0, Math.round(value)));

const calculator = (code: (value: number) => string): Write =>
  custom((value, sim) => {
    sim.calculator(code(value));
  });

/** Asobo's light SET events take the state, then the light's index. */
const lightsSet = (name: string, indices: readonly number[], on: boolean): string =>
  indices.map((index) => `${index} ${on ? 1 : 0} (>K:2:${name})`).join(" ");

// ELEC

const elec: Control[] = [
  ...family([1, 2], (n) => lvarSwitch(`ovhd.elec.bat${n}`, `A32NX_OVHD_ELEC_BAT_${n}_PB_IS_AUTO`)),
  // The click only acts while external power is available; the other side's pushbutton follows it regardless.
  lvarSwitch("ovhd.elec.extPwr", "A32NX_OVHD_ELEC_EXT_PWR_PB_IS_ON"),
  ...family([1, 2], (n) => ({
    key: `ovhd.elec.gen${n}`,
    read: bool(`GENERAL ENG MASTER ALTERNATOR:${n}`),
    write: toggle(`TOGGLE_ALTERNATOR${n}`),
  })),
  {
    key: "ovhd.elec.apuGen",
    read: bool("APU GENERATOR SWITCH:1"),
    write: toggle("APU_GENERATOR_SWITCH_TOGGLE", 1),
  },
  ...plain([
    ["ovhd.elec.busTie", "A32NX_OVHD_ELEC_BUS_TIE_PB_IS_AUTO"],
    ["ovhd.elec.acEssFeed", "A32NX_OVHD_ELEC_AC_ESS_FEED_PB_IS_NORMAL"],
    ["ovhd.elec.galyCab", "A32NX_OVHD_ELEC_GALY_AND_CAB_PB_IS_AUTO"],
    ["ovhd.elec.commercial", "A32NX_OVHD_ELEC_COMMERCIAL_PB_IS_ON"],
    ["ovhd.elec.emerGen1Line", "A32NX_OVHD_EMER_ELEC_GEN_1_LINE_PB_IS_ON"],
  ]),
  ...family([1, 2], (n) => latch(`ovhd.elec.idg${n}`, `A32NX_OVHD_ELEC_IDG_${n}_PB_IS_RELEASED`)),
  press("ovhd.elec.ratManOn", "A32NX_OVHD_EMER_ELEC_RAT_AND_EMER_GEN_IS_PRESSED"),
];

// ADIRS

const adirs = (n: number): Control[] => [
  // 0 OFF, 1 NAV, 2 ATT.
  lvarSwitch(`ovhd.adirs.ir${n}Mode`, `A32NX_OVHD_ADIRS_IR_${n}_MODE_SELECTOR_KNOB`),
  lvarSwitch(`ovhd.adirs.ir${n}`, `A32NX_OVHD_ADIRS_IR_${n}_PB_IS_ON`),
  lvarSwitch(`ovhd.adirs.adr${n}`, `A32NX_OVHD_ADIRS_ADR_${n}_PB_IS_ON`),
];

// EXT LT

const strobe = lvar("LIGHTING_STROBE_0");
const navLogo = lvar("A32NX_LIGHTS_NAV_LOGO");
const nose = lvar("LIGHTING_LANDING_1");

const landingLight = (side: string, index: number): Control => {
  const position = lvar(`LIGHTING_LANDING_${index}`);
  return {
    key: `ovhd.extLt.land${side}`,
    // 0 ON, 1 OFF, 2 RETRACT.
    read: position,
    write: inputEvent(
      `LIGHTING_LANDING_${index}`,
      custom((value, sim) => {
        const at = detent(value);
        sim.set(position, at);
        sim.set(lvar(`LANDING_${index}_Retracted`), at === 2 ? 1 : 0);
        sim.calculator(lightsSet("LANDING_LIGHTS_SET", [index], at === 0));
      }),
    ),
  };
};

const extLt: Control[] = [
  {
    key: "ovhd.extLt.strobe",
    // 0 ON, 1 AUTO, 2 OFF. AUTO keeps the strobes switched on and dims them on the ground.
    read: strobe,
    write: inputEvent(
      "LIGHTING_STROBE_0",
      custom((value, sim) => {
        const at = detent(value);
        sim.set(strobe, at);
        sim.set(lvar("STROBE_0_Auto"), at === 1 ? 1 : 0);
        sim.calculator(lightsSet("STROBES_SET", [0], at !== 2));
      }),
    ),
  },
  { key: "ovhd.extLt.beacon", read: bool("LIGHT BEACON"), write: event("BEACON_LIGHTS_SET") },
  {
    key: "ovhd.extLt.wing",
    read: bool("LIGHT WING"),
    write: calculator((value) => lightsSet("WING_LIGHTS_SET", [0, 1], value > 0)),
  },
  {
    key: "ovhd.extLt.navLogo",
    // 0 OFF, 1 SYS 1, 2 SYS 2.
    read: navLogo,
    write: inputEvent(
      "A32NX_OVH_LIGHTS_NAV_LOGO_SW",
      custom((value, sim) => {
        const at = detent(value);
        sim.set(navLogo, at);
        // Each system lights its own three nav bulbs; the logo lights follow either.
        sim.calculator(
          [
            lightsSet("NAV_LIGHTS_SET", [1, 2, 3], at === 1),
            lightsSet("NAV_LIGHTS_SET", [4, 5, 6], at === 2),
            lightsSet("LOGO_LIGHTS_SET", [0], at > 0),
          ].join(" "),
        );
      }),
    ),
  },
  {
    key: "ovhd.extLt.rwyTurnoff",
    read: bool("LIGHT TAXI:2"),
    write: calculator((value) => lightsSet("TAXI_LIGHTS_SET", [2, 3], value > 0)),
  },
  landingLight("L", 2),
  landingLight("R", 3),
  {
    key: "ovhd.extLt.nose",
    // 0 T.O., 1 TAXI, 2 OFF. T.O. lights the taxi light too.
    read: nose,
    write: inputEvent(
      "LIGHTING_LANDING_1",
      custom((value, sim) => {
        const at = detent(value);
        sim.set(nose, at);
        sim.calculator(
          `${lightsSet("LANDING_LIGHTS_SET", [1], at === 0)} ${lightsSet("TAXI_LIGHTS_SET", [1], at !== 2)}`,
        );
      }),
    ),
  },
];

// SIGNS and INT LT

const potentiometer = (key: string, index: number): Control => ({
  key,
  read: simvar(`LIGHT POTENTIOMETER:${index}`, "percent"),
  write: calculator((value) => `${Math.round(value)} ${index} (>K:2:LIGHT_POTENTIOMETER_SET)`),
  tolerance: 1,
  rateHz: 10,
});

const lights: Control[] = [
  {
    key: "ovhd.signs.seatBelts",
    read: bool("CABIN SEATBELTS ALERT SWITCH"),
    write: toggle("CABIN_SEATBELTS_ALERT_SWITCH_TOGGLE"),
  },
  ...plain([
    // 0 ON, 1 AUTO, 2 OFF.
    ["ovhd.signs.noSmoking", "XMLVAR_SWITCH_OVHD_INTLT_NOSMOKING_Position"],
    ["ovhd.signs.emerExit", "XMLVAR_SWITCH_OVHD_INTLT_EMEREXIT_Position"],
    // 0 TEST, 1 BRT, 2 DIM.
    ["ovhd.intLt.annLt", "A32NX_OVHD_INTLT_ANN"],
    ["ovhd.intLt.stbyCompass", "A32NX_STBY_COMPASS_LIGHT_TOGGLE"],
  ]),
  {
    key: "ovhd.intLt.dome",
    read: simvar("LIGHT POTENTIOMETER:7", "percent"),
    write: calculator((value) => {
      // Three detents: BRT 100, DIM 20, OFF 0.
      const level = value >= 60 ? 100 : value > 0 ? 20 : 0;
      return `${level > 0 ? 1 : 0} (>K:2:CABIN_LIGHTS_SET) ${level} (>K:LIGHT_POTENTIOMETER_7_SET)`;
    }),
    tolerance: 1,
  },
  potentiometer("ovhd.intLt.integ", 86),
  potentiometer("ovhd.intLt.readingL", 96),
  potentiometer("ovhd.intLt.readingR", 97),
];

// APU

const apu: Control[] = [
  lvarSwitch("ovhd.apu.master", "A32NX_OVHD_APU_MASTER_SW_PB_IS_ON"),
  { ...lvarSwitch("ovhd.apu.start", "A32NX_OVHD_APU_START_PB_IS_ON"), risingOnly: true },
];

// FUEL

const fuelPump = (key: string, pump: number): Control => ({
  key,
  read: simvar(`FUELSYSTEM PUMP SWITCH:${pump}`),
  write: toggle("FUELSYSTEM_PUMP_TOGGLE", pump),
});

const fuelValve = (key: string, valve: number): Control => ({
  key,
  read: simvar(`FUELSYSTEM VALVE SWITCH:${valve}`),
  write: toggle("FUELSYSTEM_VALVE_TOGGLE", valve),
});

const fuelModeSel = lvar("A32NX_OVHD_FUEL_MODESEL_MANUAL");

const fuel: Control[] = [
  fuelPump("ovhd.fuel.l1", 2),
  fuelPump("ovhd.fuel.l2", 5),
  fuelValve("ovhd.fuel.ctr1", 9),
  fuelValve("ovhd.fuel.ctr2", 10),
  fuelPump("ovhd.fuel.r1", 3),
  fuelPump("ovhd.fuel.r2", 6),
  fuelValve("ovhd.fuel.xFeed", 3),
  {
    key: "ovhd.fuel.modeSel",
    read: fuelModeSel,
    write: custom((value, sim) => {
      const manual = value > 0 ? 1 : 0;
      sim.set(fuelModeSel, manual);
      // The centre tank's transfer junctions follow the mode: 1 auto, 2 manual.
      sim.calculator(`${manual + 1} 4 (>K:2:FUELSYSTEM_JUNCTION_SET) ${manual + 1} 5 (>K:2:FUELSYSTEM_JUNCTION_SET)`);
    }),
  },
];

// AIR COND, BLEED and VENTILATION

const zoneTemperature = (key: string, zone: string): Control => ({
  // 0 to 300, cold to hot.
  ...lvarSwitch(key, `A32NX_OVHD_COND_${zone}_SELECTOR_KNOB`),
  tolerance: 1,
  rateHz: 10,
});

const air: Control[] = [
  lvarSwitch("ovhd.air.apuBleed", "A32NX_OVHD_PNEU_APU_BLEED_PB_IS_ON"),
  ...family([1, 2], (n) => lvarSwitch(`ovhd.air.eng${n}Bleed`, `A32NX_OVHD_PNEU_ENG_${n}_BLEED_PB_IS_AUTO`)),
  ...plain([
    // 0 SHUT, 1 AUTO, 2 OPEN.
    ["ovhd.air.xBleed", "A32NX_KNOB_OVHD_AIRCOND_XBLEED_Position"],
    // 0 LO, 1 NORM, 2 HI.
    ["ovhd.air.packFlow", "A32NX_KNOB_OVHD_AIRCOND_PACKFLOW_Position"],
  ]),
  ...family([1, 2], (n) => lvarSwitch(`ovhd.air.pack${n}`, `A32NX_OVHD_COND_PACK_${n}_PB_IS_ON`)),
  zoneTemperature("ovhd.air.ckptTemp", "CKPT"),
  zoneTemperature("ovhd.air.fwdTemp", "FWD"),
  zoneTemperature("ovhd.air.aftTemp", "AFT"),
  ...plain([
    ["ovhd.air.hotAir", "A32NX_OVHD_COND_HOT_AIR_PB_IS_ON"],
    ["ovhd.air.ramAir", "A32NX_AIRCOND_RAMAIR_TOGGLE"],
    ["ovhd.vent.blower", "A32NX_VENTILATION_BLOWER_TOGGLE"],
    ["ovhd.vent.extract", "A32NX_VENTILATION_EXTRACT_TOGGLE"],
    ["ovhd.vent.cabFans", "A32NX_OVHD_VENT_CAB_FANS_PB_IS_ON"],
  ]),
];

// ANTI ICE

const antiIce: Control[] = [
  lvarSwitch("ovhd.antiIce.wing", "A32NX_BUTTON_OVHD_ANTI_ICE_WING_POSITION"),
  ...family([1, 2], (n) => lvarSwitch(`ovhd.antiIce.eng${n}`, `A32NX_BUTTON_OVHD_ANTI_ICE_ENG_${n}_POSITION`)),
  // Probe heat is automatic with an engine running; this forces it on.
  lvarSwitch("ovhd.antiIce.probeWindow", "A32NX_MAN_PITOT_HEAT"),
];

// HYD

const hyd: Control[] = [
  ...family([1, 2], (n) => lvarSwitch(`ovhd.hyd.eng${n}Pump`, `A32NX_OVHD_HYD_ENG_${n}_PUMP_PB_IS_AUTO`)),
  ...plain([
    ["ovhd.hyd.blueElecPump", "A32NX_OVHD_HYD_EPUMPB_PB_IS_AUTO"],
    ["ovhd.hyd.ptu", "A32NX_OVHD_HYD_PTU_PB_IS_AUTO"],
    // AUTO (1) leaves the pump to the cargo doors; ON (0) runs it.
    ["ovhd.hyd.yellowElecPump", "A32NX_OVHD_HYD_EPUMPY_PB_IS_AUTO"],
    ["ovhd.hyd.leakG", "A32NX_OVHD_HYD_LEAK_MEASUREMENT_G_PB_IS_AUTO"],
    ["ovhd.hyd.leakB", "A32NX_OVHD_HYD_LEAK_MEASUREMENT_B_PB_IS_AUTO"],
    ["ovhd.hyd.leakY", "A32NX_OVHD_HYD_LEAK_MEASUREMENT_Y_PB_IS_AUTO"],
  ]),
  press("ovhd.hyd.ratManOn", "A32NX_OVHD_HYD_RAT_MAN_ON_IS_PRESSED"),
  {
    // The maintenance panel's BLUE PUMP OVRD, named EPUMPY in the aircraft: the hydraulics flip IS_ON on each press.
    key: "ovhd.hyd.bluePumpOvrd",
    read: lvar("A32NX_OVHD_HYD_EPUMPY_OVRD_IS_ON"),
    write: pulse(lvar("A32NX_OVHD_HYD_EPUMPY_OVRD_IS_PRESSED")),
  },
];

// FLT CTL

const flightComputer = (name: string, n: number): Control =>
  lvarSwitch(`ovhd.fltCtl.${name.toLowerCase()}${n}`, `A32NX_${name}_${n}_PUSHBUTTON_PRESSED`);

const flightControls: Control[] = [
  ...family([1, 2], (n) => flightComputer("ELAC", n)),
  ...family([1, 2, 3], (n) => flightComputer("SEC", n)),
  ...family([1, 2], (n) => flightComputer("FAC", n)),
];

// ENG, CABIN PRESS

const ldgElev = lvar("XMLVAR_KNOB_OVHD_CABINPRESS_LDGELEV");

const engineAndPressure: Control[] = [
  ...family([1, 2], (n) => lvarSwitch(`ovhd.eng.manStart${n}`, `A32NX_ENGMANSTART${n}_TOGGLE`)),
  ...family([1, 2], (n) => lvarSwitch(`ovhd.eng.fadecGndPwr${n}`, `A32NX_OVHD_FADEC_${n}`)),
  {
    key: "ovhd.press.ldgElev",
    // The knob's travel from 0 (AUTO) to 18; 2 to 18 select -2000 to 14000 ft.
    read: ldgElev,
    write: custom((value, sim) => {
      sim.set(ldgElev, value);
      sim.set(lvar("A32NX_OVHD_PRESS_LDG_ELEV_KNOB"), (value - 4) * 1000);
    }),
    tolerance: 0.1,
    rateHz: 10,
  },
  ...plain([
    // Spring-loaded to 1 (neutral); moves the outflow valve only in MAN mode.
    ["ovhd.press.manVs", "A32NX_OVHD_PRESS_MAN_VS_CTL_SWITCH"],
    ["ovhd.press.modeSel", "A32NX_OVHD_PRESS_MODE_SEL_PB_IS_AUTO"],
    ["ovhd.press.ditching", "A32NX_OVHD_PRESS_DITCHING_PB_IS_ON"],
  ]),
];

// FIRE

const firePanel = (id: string, agents: readonly number[]): Control[] => {
  const name = id.toLowerCase();
  return [
    lvarSwitch(`ovhd.fire.${name}Test`, `A32NX_FIRE_TEST_${id}`),
    lvarSwitch(`ovhd.fire.${name}Guard`, `A32NX_FIRE_GUARD_${id}`),
    latch(`ovhd.fire.${name}Push`, `A32NX_FIRE_BUTTON_${id}`),
    ...family(agents, (n) => latch(`ovhd.fire.${name}Agent${n}`, `A32NX_FIRE_${id}_AGENT${n}_Discharge`)),
  ];
};

const fire: Control[] = [
  ...firePanel("ENG1", [1, 2]),
  ...firePanel("ENG2", [1, 2]),
  ...firePanel("APU", [1]),
  lvarSwitch("ovhd.fire.cargoTest", "A32NX_FIRE_TEST_CARGO"),
  latch("ovhd.fire.cargoFwdDisch", "A32NX_CARGOSMOKE_FWD_DISCHARGED"),
  latch("ovhd.fire.cargoAftDisch", "A32NX_CARGOSMOKE_AFT_DISCHARGED"),
];

// GPWS, RCDR, OXYGEN, CALLS, EVAC, WIPERS and the rest

const masksDeployed = lvar("A32NX_OXYGEN_MASKS_DEPLOYED");

const wiper = (side: string, circuit: number): Control[] => [
  {
    key: `ovhd.wipers.${side}`,
    read: bool(`CIRCUIT SWITCH ON:${circuit}`),
    write: toggle("ELECTRICAL_CIRCUIT_TOGGLE", circuit),
  },
  {
    // SLOW is 75, FAST 100; the knob sets this before switching the circuit on.
    key: `ovhd.wipers.${side}Speed`,
    read: simvar(`CIRCUIT POWER SETTING:${circuit}`, "percent"),
    write: calculator((value) => `${Math.round(value)} ${circuit} (>K:2:ELECTRICAL_CIRCUIT_POWER_SETTING_SET)`),
    tolerance: 1,
  },
];

const misc: Control[] = [
  ...plain([
    ["ovhd.gpws.terr", "A32NX_GPWS_TERR_OFF"],
    ["ovhd.gpws.sys", "A32NX_GPWS_SYS_OFF"],
    ["ovhd.gpws.gs", "A32NX_GPWS_GS_OFF"],
    ["ovhd.gpws.flap", "A32NX_GPWS_FLAP_OFF"],
    ["ovhd.gpws.ldgFlap3", "A32NX_GPWS_FLAPS3"],
    // GND CTL is held to switch on and pressed again to go back to AUTO; the click code tracks it in this L:var.
    ["ovhd.rcdr.gndCtl", "A32NX_RCDR_GROUND_CONTROL_ON"],
    ["ovhd.rcdr.cvrTest", "A32NX_RCDR_TEST"],
    ["ovhd.oxy.tmrReset", "A32NX_OXYGEN_TMR_RESET"],
    ["ovhd.oxy.crewSupply", "PUSH_OVHD_OXYGEN_CREW"],
    ["ovhd.calls.mech", "PUSH_OVHD_CALLS_MECH"],
    ["ovhd.calls.all", "PUSH_OVHD_CALLS_ALL"],
    ["ovhd.calls.fwd", "PUSH_OVHD_CALLS_FWD"],
    ["ovhd.calls.aft", "PUSH_OVHD_CALLS_AFT"],
    ["ovhd.calls.emer", "A32NX_CALLS_EMER_ON"],
    ["ovhd.evac.command", "A32NX_EVAC_COMMAND_TOGGLE"],
    ["ovhd.evac.hornOff", "PUSH_OVHD_EVAC_HORN"],
    ["ovhd.evac.captPurs", "A32NX_EVAC_CAPT_TOGGLE"],
    ["ovhd.misc.doorVideo", "A32NX_OVHD_COCKPITDOORVIDEO_TOGGLE"],
    ["ovhd.misc.svgeIntOvrd", "A32NX_SVGEINT_OVRD_ON"],
    ["ovhd.misc.avionicsCompLt", "A32NX_AVIONICS_COMPLT_ON"],
    ["ovhd.misc.apuAutoExtgTest", "A32NX_APU_AUTOEXITING_TEST_ON"],
    ["ovhd.misc.dataLoading", "A32NX_DLS_ON"],
  ]),
  {
    // MASK MAN ON lights PASSENGER with the masks; TMR RESET (synced on its own) stows them again.
    key: "ovhd.oxy.masks",
    read: masksDeployed,
    write: custom((value, sim) => {
      sim.set(masksDeployed, value);
      sim.set(lvar("A32NX_OXYGEN_PASSENGER_LIGHT_ON"), value);
    }),
  },
  ...wiper("left", 77),
  ...wiper("right", 80),
];

/** The overhead panel, in the order a cold and dark cockpit comes alive. */
export const overheadAreas: Area[] = [
  { name: "Overhead ELEC", controls: elec },
  { name: "Overhead ADIRS", controls: [1, 2, 3].flatMap(adirs) },
  { name: "Overhead EXT LT", controls: extLt },
  { name: "Overhead SIGNS and INT LT", controls: lights },
  { name: "Overhead APU", controls: apu },
  { name: "Overhead FUEL", controls: fuel },
  { name: "Overhead AIR COND", controls: air },
  { name: "Overhead ANTI ICE", controls: antiIce },
  { name: "Overhead HYD", controls: hyd },
  { name: "Overhead FLT CTL", controls: flightControls },
  { name: "Overhead ENG and CABIN PRESS", controls: engineAndPressure },
  { name: "Overhead FIRE", controls: fire },
  { name: "Overhead GPWS, RCDR, OXYGEN, CALLS, EVAC, WIPERS", controls: misc },
];
