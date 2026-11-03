// The desktop app's window and the connector running in its main process. The connector owns all state and
// sends the window a full snapshot whenever anything changes; the window sends commands back.

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
    };

export interface ConnectorStatus {
  version: string;
  account: AccountStatus;
  sim: SimStatus;
  coop: CoopStatus;
}

// The window is untrusted input, so the main process parses every command with this before the connector sees
// it. Unknown fields are stripped.
export const connectorCommandSchema = z.discriminatedUnion("type", [
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
