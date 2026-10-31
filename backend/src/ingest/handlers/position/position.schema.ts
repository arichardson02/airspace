import { boolean, doublePrecision, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { connectorSessions } from "../hello/hello.schema.js";

/** In-flight position samples. (session, seq) makes retried batches idempotent. */
export const positions = pgTable(
  "positions",
  {
    connectorSessionId: text("connector_session_id")
      .notNull()
      .references(() => connectorSessions.id),
    seq: integer("seq").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    altitudeFt: doublePrecision("altitude_ft").notNull(),
    altitudeAglFt: doublePrecision("altitude_agl_ft").notNull(),
    headingTrueDeg: doublePrecision("heading_true_deg").notNull(),
    groundSpeedKts: doublePrecision("ground_speed_kts").notNull(),
    indicatedAirspeedKts: doublePrecision("indicated_airspeed_kts").notNull(),
    verticalSpeedFpm: doublePrecision("vertical_speed_fpm").notNull(),
    onGround: boolean("on_ground").notNull(),
    fuelWeightLbs: doublePrecision("fuel_weight_lbs").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.connectorSessionId, table.seq] }),
    index("positions_session_ts_idx").on(table.connectorSessionId, table.ts),
  ],
);
