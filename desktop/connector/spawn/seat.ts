import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RawBuffer, SimConnectConstants, SimConnectDataType, type SimConnectConnection } from "node-simconnect";
import { DEFINITION } from "../sim-ids.js";
import { findInPackages, type MsfsFolders } from "../msfs-paths.js";

// Puts the co-pilot's camera in the right seat. `CAMERA VIEW TYPE AND INDEX:0` is the view type (1, the pilot views)
// and `:1` the view within it: the 1-based position of the co-pilot's camera among the aircraft's pilot cameras in
// its cameras.cfg, VR cameras left out. Proven on the FlightFX C750 and Asobo C172.

const PILOT_VIEWS = 1;

/** The co-pilot camera's index in the aircraft's cameras.cfg (livery first, then its base aircraft). */
export function coPilotView(folders: MsfsFolders, paths: readonly string[]): number | undefined {
  for (const path of paths) {
    const cfg = findInPackages(folders, path);
    const cameras = cfg === undefined ? undefined : join(dirname(cfg), "cameras.cfg");
    if (cameras === undefined || !existsSync(cameras)) continue;
    const pilotCameras = readFileSync(cameras, "latin1")
      .split(/^\s*\[CAMERADEFINITION\.\d+\]/im)
      .filter((block) => /SubCategory\s*=\s*"Pilot"/i.test(block) && !/SubCategoryItem\s*=\s*"PilotVR"/i.test(block));
    const index = pilotCameras.findIndex((block) => /SubCategoryItem\s*=\s*"CoPilot"/i.test(block));
    if (index >= 0) return index + 1;
  }
  return undefined;
}

export function takeSeat(handle: SimConnectConnection, view: number): void {
  handle.addToDataDefinition(DEFINITION.seat, "CAMERA VIEW TYPE AND INDEX:0", "number", SimConnectDataType.INT32);
  handle.addToDataDefinition(DEFINITION.seat, "CAMERA VIEW TYPE AND INDEX:1", "number", SimConnectDataType.INT32);
  const buffer = new RawBuffer(8);
  buffer.writeInt32(PILOT_VIEWS);
  buffer.writeInt32(view);
  handle.setDataOnSimObject(DEFINITION.seat, SimConnectConstants.OBJECT_ID_USER, {
    buffer,
    arrayCount: 0,
    tagged: false,
  });
  handle.clearDataDefinition(DEFINITION.seat);
}
