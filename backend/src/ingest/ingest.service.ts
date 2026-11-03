import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  connectorMessageSchema,
  type ConnectorMessage,
  type ConnectorMessageType,
  type IngestBatch,
} from "@fs-career/contracts";
import { DRIZZLE, type Database } from "../database/database.module.js";
import { connectorSessions } from "./handlers/hello/hello.schema.js";
import {
  INGEST_HANDLERS,
  type AnyIngestHandler,
  type IngestContext,
  type IngestHandlerOf,
  type MessageOf,
} from "./ingest-handler.js";

@Injectable()
export class IngestService implements OnModuleInit {
  private readonly logger = new Logger(IngestService.name);
  private readonly sessionHandlers: AnyIngestHandler[];
  private readonly dataHandlers: AnyIngestHandler[];

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(INGEST_HANDLERS) private readonly handlers: AnyIngestHandler[],
  ) {
    this.sessionHandlers = handlers.filter((handler) => handler.createsSession === true);
    this.dataHandlers = handlers.filter((handler) => handler.createsSession !== true);
  }

  /** Fails startup when a contract message type has no handler, or more than one. */
  onModuleInit(): void {
    const contractTypes = connectorMessageSchema.options.map((option) => option.shape.type.value);

    for (const type of contractTypes) {
      const count = this.handlers.filter((handler) => handler.type === type).length;
      if (count !== 1) {
        throw new Error(`Expected exactly one ingest handler for "${type}", found ${count}`);
      }
    }
  }

  async ingest(batch: IngestBatch, userId: string): Promise<number> {
    const messages = batch.messages.toSorted((a, b) => a.seq - b.seq);

    return this.db.transaction(async (tx) => {
      const context: IngestContext = {
        tx,
        connectorSessionId: batch.connectorSessionId,
        userId,
        receivedAt: new Date(),
      };

      await runHandlers(this.sessionHandlers, messages, context);

      const updated = await tx
        .update(connectorSessions)
        .set({ lastSeenAt: context.receivedAt })
        .where(and(eq(connectorSessions.id, context.connectorSessionId), eq(connectorSessions.userId, userId)))
        .returning({ id: connectorSessions.id });

      if (updated.length === 0) {
        // Retrying can't fix a session we never saw a hello for (or one another pilot owns), so
        // drop the batch instead of failing and leaving the connector stuck resending it.
        this.logger.warn(
          `Dropped ${batch.messages.length} message(s) for unknown session ${context.connectorSessionId}`,
        );
        return 0;
      }

      await runHandlers(this.dataHandlers, messages, context);

      return batch.messages.length;
    });
  }
}

/** Runs the handlers one at a time, in order, since they share the transaction's connection. */
async function runHandlers(
  handlers: AnyIngestHandler[],
  messages: ConnectorMessage[],
  context: IngestContext,
): Promise<void> {
  for (const handler of handlers) {
    // oxlint-disable-next-line no-await-in-loop -- one pg connection per transaction, and handler order matters
    await runHandler(handler, messages, context);
  }
}

async function runHandler<T extends ConnectorMessageType>(
  handler: IngestHandlerOf<T>,
  messages: ConnectorMessage[],
  context: IngestContext,
): Promise<void> {
  const own = messages.filter((message): message is MessageOf<T> => message.type === handler.type);
  if (own.length > 0) await handler.handle(own, context);
}
