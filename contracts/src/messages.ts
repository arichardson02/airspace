import { z } from "zod";

/** Sent once after the connector connects to the sim. */
export const helloSchema = z.object({
  connectorVersion: z.string(),
  sim: z.object({
    name: z.string(),
    versionMajor: z.number().int(),
    versionMinor: z.number().int(),
  }),
});

/** In-flight metrics sampled from the aircraft. */
export const positionSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitudeFt: z.number(),
  altitudeAglFt: z.number(),
  headingTrueDeg: z.number(),
  groundSpeedKts: z.number(),
  indicatedAirspeedKts: z.number(),
  verticalSpeedFpm: z.number(),
  onGround: z.boolean(),
  fuelWeightLbs: z.number(),
});

const envelope = <TType extends string, TPayload extends z.ZodType>(type: TType, payload: TPayload) =>
  z.object({
    type: z.literal(type),
    /** Increases by one per message within a connector session, for ordering and gap detection. */
    seq: z.number().int().nonnegative(),
    /** Wall-clock time the connector recorded the message. */
    ts: z.iso.datetime(),
    payload,
  });

export const connectorMessageSchema = z.discriminatedUnion("type", [
  envelope("connector.hello", helloSchema),
  envelope("position", positionSchema),
]);

export const ingestBatchSchema = z.object({
  /** Random id generated each time the connector starts. */
  connectorSessionId: z.string(),
  messages: z.array(connectorMessageSchema).min(1),
});

export type Hello = z.infer<typeof helloSchema>;
export type Position = z.infer<typeof positionSchema>;
export type ConnectorMessage = z.infer<typeof connectorMessageSchema>;
export type ConnectorMessageType = ConnectorMessage["type"];
export type IngestBatch = z.infer<typeof ingestBatchSchema>;
