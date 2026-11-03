import {
  DataRequestFlag,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod,
  type SimConnectConnection,
} from "node-simconnect";
import { DEFINITION, REQUEST } from "../sim-ids.js";
import { datumName, datumUnit, type AircraftIdentity, type AircraftProfile } from "./profile.js";
import { findProfile, PROFILES } from "./profiles.js";

// Checked every couple of seconds rather than on AircraftLoaded: an aircraft's own variables (the A32NX's "ready"
// flag) only settle a while after it loads.
const CHECK_EVERY_SECONDS = 2;

export interface DetectedAircraft {
  identity: AircraftIdentity;
  profile: AircraftProfile;
  /** When this aircraft was first seen (epoch ms). */
  loadedAt: number;
}

export interface AircraftDetector {
  current(): DetectedAircraft | undefined;
}

/** Watches which aircraft is loaded and which profile fits it. */
export function watchAircraft(
  handle: SimConnectConnection,
  onChange: (aircraft: DetectedAircraft) => void,
): AircraftDetector {
  const identityDatums = [
    ...new Map(PROFILES.flatMap((profile) => profile.identity).map((datum) => [datumName(datum), datum])).values(),
  ];
  handle.addToDataDefinition(DEFINITION.identity, "TITLE", null, SimConnectDataType.STRING256);
  handle.addToDataDefinition(DEFINITION.identity, "ATC MODEL", null, SimConnectDataType.STRING64);
  for (const datum of identityDatums) {
    handle.addToDataDefinition(DEFINITION.identity, datumName(datum), datumUnit(datum), SimConnectDataType.FLOAT64);
  }

  let current: DetectedAircraft | undefined;
  handle.on("simObjectData", (sample) => {
    if (sample.requestID !== REQUEST.identity) return;
    const title = sample.data.readString256();
    const atcModel = sample.data.readString64();
    const values = new Map(identityDatums.map((datum) => [datum.name, sample.data.readFloat64()]));
    const identity: AircraftIdentity = { title, atcModel, values };
    const profile = findProfile(identity);
    if (current?.identity.title === title && current.profile.id === profile.id) {
      current = { ...current, identity };
      return;
    }
    current = { identity, profile, loadedAt: Date.now() };
    console.log(`Aircraft: ${title} (${profile.id === "generic" ? "no cockpit profile" : profile.id})`);
    onChange(current);
  });
  handle.requestDataOnSimObject(
    REQUEST.identity,
    DEFINITION.identity,
    SimConnectConstants.OBJECT_ID_USER,
    SimConnectPeriod.SECOND,
    DataRequestFlag.DATA_REQUEST_FLAG_DEFAULT,
    0,
    CHECK_EVERY_SECONDS,
  );

  return { current: () => current };
}
