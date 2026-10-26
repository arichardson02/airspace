import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** One row per connector run, created from its connector.hello message. */
export const connectorSessions = pgTable('connector_sessions', {
  id: text('id').primaryKey(),
  connectorVersion: text('connector_version').notNull(),
  simName: text('sim_name').notNull(),
  simVersionMajor: integer('sim_version_major').notNull(),
  simVersionMinor: integer('sim_version_minor').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
});
