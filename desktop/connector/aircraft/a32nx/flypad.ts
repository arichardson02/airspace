import { lvar, toDatum, type Area, type Control } from "../profile.js";

// flyPad options that change the aircraft itself, decided by the host's aircraft. The flyPad keeps its settings in
// its own storage, out of SimConnect's reach, and copies these into L:vars the aircraft reads when it loads and
// whenever one changes (globalSyncedSettings in FlyByWire's EFB/Settings/sync.ts); those L:vars are what's synced.
// The other pilot's flyPad still shows their own choices. Personal options stay unsynced: sounds, brightness,
// units, the pilot avatars, and what depends on each pilot's setup (the tiller, home cockpit, GSX).

const setting = (key: string, name: string): Control => ({
  key: `efb.${key}`,
  read: lvar(name),
  write: toDatum(),
  fromHost: true,
});

export const flypadAreas: Area[] = [
  {
    name: "flyPad options",
    controls: [
      setting("adirsAlignTime", "A32NX_CONFIG_ADIRS_IR_ALIGN_TIME"),
      setting("boardingRate", "A32NX_BOARDING_RATE"),
      setting("refuelRate", "A32NX_EFB_REFUEL_RATE_SETTING"),
      setting("foSyncEfis", "A32NX_FO_SYNC_EFIS_ENABLED"),
      setting("radioReceiverUsage", "A32NX_RADIO_RECEIVER_USAGE_ENABLED"),
      setting("portableDevices", "A32NX_CONFIG_USING_PORTABLE_DEVICES"),
      setting("isisBaroInHg", "A32NX_ISIS_BARO_UNIT_INHG"),
      setting("wheelChocks", "A32NX_MODEL_WHEELCHOCKS_ENABLED"),
      setting("cones", "A32NX_MODEL_CONES_ENABLED"),
      setting("satcom", "A32NX_SATCOM_ENABLED"),
    ],
  },
];
