import { randomUUID } from "node:crypto";
import { createORPCClient, ORPCError } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import {
  contract,
  type ApiClient,
  type ConnectorMessage,
  type ConnectorMessageType,
} from "@fs-career/contracts";

type PayloadOf<T extends ConnectorMessageType> = Extract<ConnectorMessage, { type: T }>["payload"];

// Oldest messages are dropped past this, so a long backend outage can't exhaust memory.
const MAX_QUEUED_MESSAGES = 10_000;
const MAX_BATCH_SIZE = 500;

/**
 * Queues connector messages and sends them to the backend in batches.
 * Messages stay queued while the backend is unreachable and are retried on the next flush.
 */
export class BackendClient {
  private readonly client: ApiClient;
  private readonly sessionId = randomUUID();
  private readonly queue: ConnectorMessage[] = [];
  private seq = 0;
  private flushing: Promise<void> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private signedOut = false;

  /** `onSignedOut` runs once if the backend rejects the token, e.g. after the pilot signed out everywhere. */
  constructor(
    backendUrl: string,
    private readonly flushIntervalMs: number,
    token: string,
    private readonly onSignedOut: () => void,
  ) {
    this.client = createORPCClient(
      new OpenAPILink(contract, { url: backendUrl, headers: { authorization: `Bearer ${token}` } }),
    );
  }

  start(): void {
    this.timer = setInterval(() => void this.flush(), this.flushIntervalMs);
    // The SimConnect connection decides the process lifetime, not this timer.
    this.timer.unref();
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  send<T extends ConnectorMessageType>(type: T, payload: PayloadOf<T>): void {
    this.queue.push({ type, seq: this.seq++, ts: new Date().toISOString(), payload } as ConnectorMessage);

    if (this.queue.length > MAX_QUEUED_MESSAGES) {
      this.queue.splice(0, this.queue.length - MAX_QUEUED_MESSAGES);
    }
  }

  flush(): Promise<void> {
    this.flushing ??= this.sendQueued().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async sendQueued(): Promise<void> {
    while (this.queue.length > 0 && !this.signedOut) {
      const messages = this.queue.slice(0, MAX_BATCH_SIZE);

      try {
        await this.client.ingest.batch({ connectorSessionId: this.sessionId, messages });
      } catch (err) {
        if (err instanceof ORPCError && err.status === 401) {
          this.signedOut = true;
          this.onSignedOut();
          return;
        }
        console.warn(
          `Backend unreachable, ${this.queue.length} message(s) queued:`,
          err instanceof Error ? err.message : err,
        );
        return;
      }

      this.queue.splice(0, messages.length);
    }
  }
}
