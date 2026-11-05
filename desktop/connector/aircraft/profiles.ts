import { a32nx } from "./a32nx/index.js";
import { generic } from "./generic.js";
import type { AircraftIdentity, AircraftProfile } from "./profile.js";

/** Every aircraft with a profile of its own. Add new aircraft here. */
export const PROFILES: readonly AircraftProfile[] = [a32nx];

/** Every profile's SimBrief pilot ID key: a co-pilot is spawning from the menus, before any aircraft is loaded. */
export const simbriefPilotIdKeys = (): string[] =>
  PROFILES.flatMap((profile) => (profile.simbriefPilotIdKey === undefined ? [] : [profile.simbriefPilotIdKey]));

/** The profile for the loaded aircraft, or the generic one (motion only) when there's none. */
export const findProfile = (identity: AircraftIdentity): AircraftProfile =>
  PROFILES.find((profile) => profile.matches(identity)) ?? generic;
