import { simvar, toDatum, type AircraftProfile, type Control } from "./profile.js";

const throttle = (engine: 1 | 2): Control => ({
  key: `throttle.${engine}`,
  read: simvar(`GENERAL ENG THROTTLE LEVER POSITION:${engine}`, "percent"),
  write: toDatum(),
  tolerance: 0.1,
});

/**
 * Any aircraft without a profile of its own: the motion is shared and the pilot flying sets the thrust levers, but
 * nothing else in the cockpit syncs.
 */
export const generic: AircraftProfile = {
  id: "generic",
  version: 1,
  name: "",
  identity: [],
  matches: () => true,
  areas: [],
  aux: {},
  actions: [],
  flightControls: [throttle(1), throttle(2)],
};
