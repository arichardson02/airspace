// The desktop app's window and the connector running in its main process. The connector owns the state (the
// main process adds the app's own update) and sends the window a full snapshot whenever anything changes; the
// window sends commands back.

import { z } from "zod";
import type { GroupPeer } from "./group.js";

export interface Pilot {
  id: string;
  name: string;
  email: string;
}

export type AccountStatus =
  | { state: "checking" }
  // Waiting for the pilot to approve `userCode` on the website.
  | { state: "signing-in"; userCode: string; verificationUrl: string }
  | { state: "signed-in"; pilot: Pilot }
  // Sign-in failed or the code expired; `retry-sign-in` starts over.
  | { state: "error"; message: string };

export type SimStatus = { state: "waiting" } | { state: "connected"; name: string; version: string };

export type CoopStatus =
  // `error` explains why the last join failed or the group ended.
  | { state: "off"; error?: string }
  | { state: "joining"; groupCode: string }
  | {
      state: "joined";
      groupCode: string;
      /** Everyone else connected, not including us. */
      peers: GroupPeer[];
      /** The pilot ID of whoever is flying. */
      flyer: string;
      /** When both pilots last moved their controls at once (epoch ms). */
      dualInputAt?: number;
      /** What's shared beyond the aircraft's motion, once a co-pilot is connected. */
      cockpit?: CockpitStatus;
    };

export interface CockpitStatus {
  /** The loaded aircraft, e.g. "A320neo (FlyByWire)". */
  aircraft: string;
  /** Whether the cockpits sync; when false only the aircraft's motion is shared. */
  synced: boolean;
  /** Short lines worth showing the pilot, e.g. why only motion is shared or that MCDU sync needs SimBridge. */
  notes: string[];
}

export type UpdateStatus =
  // Up to date, still checking, a development build, or the last check failed (it's logged and retried).
  | { state: "none" }
  | { state: "downloading"; version: string; percent: number }
  // Downloaded: installs on `restart-to-update`, or by itself when the app quits.
  | { state: "ready"; version: string }
  // Restarting into it: the connector is stopping and the installer is about to close the app.
  | { state: "installing"; version: string };

export interface ConnectorStatus {
  version: string;
  account: AccountStatus;
  sim: SimStatus;
  coop: CoopStatus;
  /** The app's own update, written by the main process rather than the connector. */
  update: UpdateStatus;
}

// What the connector acts on. Unknown fields are stripped.
const connectorCommandSchema = z.discriminatedUnion("type", [
  // Opens the sign-in page for the current code in the browser.
  z.object({ type: z.literal("open-sign-in") }),
  // Opens the pilot's dashboard on the website in the browser.
  z.object({ type: z.literal("open-website") }),
  z.object({ type: z.literal("retry-sign-in") }),
  z.object({ type: z.literal("sign-out") }),
  z.object({ type: z.literal("join-group"), groupCode: z.string() }),
  z.object({ type: z.literal("leave-group") }),
]);

export type ConnectorCommand = z.infer<typeof connectorCommandSchema>;

// Everything the window can send. The window is untrusted input, so the main process parses every command with
// this; it handles `restart-to-update` itself and passes the rest to the connector.
export const windowCommandSchema = z.discriminatedUnion("type", [
  ...connectorCommandSchema.options,
  z.object({ type: z.literal("restart-to-update") }),
]);

export type WindowCommand = z.infer<typeof windowCommandSchema>;
