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
import { INGEST_HANDLERS, type AnyIngestHandler, type IngestContext, type IngestHandler } from "./ingest-handler.js";

@Injectable()
export class IngestService implements OnModuleInit {
  private readonly logger = new Logger(IngestService.name);
  private readonly sessionHandlers: AnyIngestHandler[];
  private readonly dataHandlers: AnyIngestHandler[];

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(INGEST_HANDLERS) private readonly handlers: AnyIngestHandler[],
  ) {
    this.sessionHandlers = handlers.filter((handler) => handler.createsSession);
    this.dataHandlers = handlers.filter((handler) => !handler.createsSession);
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
    const messagesByType = new Map<ConnectorMessageType, ConnectorMessage[]>();
    for (const message of [...batch.messages].sort((a, b) => a.seq - b.seq)) {
      const group = messagesByType.get(message.type) ?? [];
      group.push(message);
      messagesByType.set(message.type, group);
    }

    return this.db.transaction(async (tx) => {
      const context: IngestContext = {
        tx,
        connectorSessionId: batch.connectorSessionId,
        userId,
        receivedAt: new Date(),
      };

      await this.runHandlers(this.sessionHandlers, messagesByType, context);

      const [session] = await tx
        .update(connectorSessions)
        .set({ lastSeenAt: context.receivedAt })
        .where(and(eq(connectorSessions.id, context.connectorSessionId), eq(connectorSessions.userId, userId)))
        .returning({ id: connectorSessions.id });

      if (!session) {
        // Retrying can't fix a session we never saw a hello for (or one another pilot owns), so
        // drop the batch instead of failing and leaving the connector stuck resending it.
        this.logger.warn(
          `Dropped ${batch.messages.length} message(s) for unknown session ${context.connectorSessionId}`,
        );
        return 0;
      }

      await this.runHandlers(this.dataHandlers, messagesByType, context);

      return batch.messages.length;
    });
  }

  private async runHandlers(
    handlers: AnyIngestHandler[],
    messagesByType: Map<ConnectorMessageType, ConnectorMessage[]>,
    context: IngestContext,
  ): Promise<void> {
    for (const handler of handlers) {
      const messages = messagesByType.get(handler.type);
      if (messages?.length) {
        // Grouping by type guarantees these messages match the handler's type.
        await (handler as IngestHandler).handle(messages, context);
      }
    }
  }
}
