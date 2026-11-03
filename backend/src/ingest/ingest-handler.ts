import type { ConnectorMessage, ConnectorMessageType } from "@fs-career/contracts";
import type { Transaction } from "../database/database.module.js";

export const INGEST_HANDLERS = Symbol("INGEST_HANDLERS");

export type MessageOf<T extends ConnectorMessageType> = Extract<ConnectorMessage, { type: T }>;

export interface IngestContext {
  tx: Transaction;
  connectorSessionId: string;
  /** The signed-in pilot sending the batch. */
  userId: string;
  receivedAt: Date;
}

/**
 * Stores one connector message type. To support a new type, add a handler folder under
 * handlers/ and register the handler in IngestModule.
 */
export interface IngestHandler<T extends ConnectorMessageType = ConnectorMessageType> {
  readonly type: T;
  /** Runs before the session check; only the handler that creates sessions should set this. */
  readonly createsSession?: boolean;
  /** Receives every message of this type in the batch, in seq order, so it can write them in bulk. */
  handle(messages: MessageOf<T>[], context: IngestContext): Promise<void>;
}

/**
 * The handler of message type T. Written as a lookup so a generic function taking it accepts any handler
 * and still sees `handle` as taking `MessageOf<T>`, which `IngestHandler<T>` with a union T doesn't allow.
 */
export type IngestHandlerOf<T extends ConnectorMessageType> = { [K in ConnectorMessageType]: IngestHandler<K> }[T];

export type AnyIngestHandler = IngestHandlerOf<ConnectorMessageType>;
