import { Injectable } from '@nestjs/common';
import type { IngestContext, IngestHandler, MessageOf } from '../../ingest-handler.js';
import { positions } from './position.schema.js';

@Injectable()
export class PositionIngestHandler implements IngestHandler<'position'> {
  readonly type = 'position';

  async handle(messages: MessageOf<'position'>[], { tx, connectorSessionId }: IngestContext): Promise<void> {
    await tx
      .insert(positions)
      .values(
        messages.map((message) => ({
          connectorSessionId,
          seq: message.seq,
          ts: new Date(message.ts),
          ...message.payload,
        })),
      )
      // (session, seq) is the primary key, so positions from a retried batch are skipped.
      .onConflictDoNothing();
  }
}
