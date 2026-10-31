import { Injectable } from '@nestjs/common';
import type { IngestContext, IngestHandler, MessageOf } from '../../ingest-handler.js';
import { connectorSessions } from './hello.schema.js';

@Injectable()
export class HelloIngestHandler implements IngestHandler<'connector.hello'> {
  readonly type = 'connector.hello';
  readonly createsSession = true;

  async handle(
    messages: MessageOf<'connector.hello'>[],
    { tx, connectorSessionId, userId, receivedAt }: IngestContext,
  ): Promise<void> {
    const [hello] = messages;

    await tx
      .insert(connectorSessions)
      .values({
        id: connectorSessionId,
        userId,
        connectorVersion: hello.payload.connectorVersion,
        simName: hello.payload.sim.name,
        simVersionMajor: hello.payload.sim.versionMajor,
        simVersionMinor: hello.payload.sim.versionMinor,
        startedAt: new Date(hello.ts),
        lastSeenAt: receivedAt,
      })
      // A retried batch resends the hello; the session already exists.
      .onConflictDoNothing();
  }
}
