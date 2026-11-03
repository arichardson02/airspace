import { custom, family, lvar, simvar, toDatum, type Control, type Write } from "../profile.js";

// What only the pilot flying sets: the thrust levers, the pitch trim and the fuel on board.

// Thrust lever angle in degrees: REV -20, IDLE 0, CL 22.5, FLX/MCT 35, TOGA 45. FlyByWire reads it every frame and
// only writes it on a throttle input, so the follower's is set directly.
const thrustLever = (engine: 1 | 2): Control => ({
  key: `fc.thrustLever${engine}`,
  read: lvar(`A32NX_AUTOTHRUST_TLA:${engine}`),
  write: toDatum(),
  tolerance: 0.1,
});

// ELEVATOR_TRIM_SET's data / 16383 is a target for the trim wheel's 0-1 position, which FlyByWire reports as 0-100.
const TRIM_EVENT = "ELEVATOR_TRIM_SET";
const TRIM_EVENT_PER_PERCENT = 16_383 / 100;
// One event drives the trim wheel toward its target for a single FlyByWire frame, at a speed proportional to how far
// off it is (trimmable_horizontal_stabilizer.rs), so the target is resent until the wheel has had time to get there.
const TRIM_RESEND_MS = 20;
const TRIM_SETTLE_MS = 4_000;

function trimWrite(): Write {
  let data = 0;
  let settleUntil = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };
  return custom((percent, sim) => {
    data = Math.round(Math.min(100, Math.max(0, percent)) * TRIM_EVENT_PER_PERCENT);
    settleUntil = Date.now() + TRIM_SETTLE_MS;
    sim.event(TRIM_EVENT, data);
    timer ??= setInterval(() => {
      if (Date.now() > settleUntil) {
        stop();
        return;
      }
      try {
        sim.event(TRIM_EVENT, data);
      } catch {
        // The connection closed since the pilot flying last moved the trim.
        stop();
      }
    }, TRIM_RESEND_MS);
  });
}

const pitchTrim: Control = {
  key: "fc.pitchTrim",
  // 0 full nose down ... 100 full nose up, over the wheel's whole travel (-4° to 13.5° of stabilizer).
  read: lvar("A32NX_HYD_TRIM_WHEEL_PERCENT"),
  write: trimWrite(),
  tolerance: 0.1,
};

// The A32NX's five tanks as the sim's legacy tank names, which FlyByWire's fuel system and refuel page use: the inner
// tanks are the mains and the outer tanks the aux. US gallons. Each sim burns its own, so the pilot flying's win.
const fuelTanks = family(
  [
    { key: "center", name: "CENTER" },
    { key: "leftInner", name: "LEFT MAIN" },
    { key: "leftOuter", name: "LEFT AUX" },
    { key: "rightInner", name: "RIGHT MAIN" },
    { key: "rightOuter", name: "RIGHT AUX" },
  ],
  (tank): Control => ({
    key: `fc.fuel.${tank.key}`,
    read: simvar(`FUEL TANK ${tank.name} QUANTITY`, "gallons"),
    write: toDatum(),
    tolerance: 0.5,
  }),
);

export const flightControls: Control[] = [thrustLever(1), thrustLever(2), pitchTrim, ...fuelTanks];
