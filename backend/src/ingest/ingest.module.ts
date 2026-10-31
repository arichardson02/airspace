import { Module } from "@nestjs/common";
import { HelloIngestHandler } from "./handlers/hello/hello.handler.js";
import { PositionIngestHandler } from "./handlers/position/position.handler.js";
import { IngestController } from "./ingest.controller.js";
import { INGEST_HANDLERS, type AnyIngestHandler } from "./ingest-handler.js";
import { IngestService } from "./ingest.service.js";

/** Register a handler here for every connector message type in the contract. */
const handlers = [HelloIngestHandler, PositionIngestHandler];

@Module({
  controllers: [IngestController],
  providers: [
    ...handlers,
    {
      provide: INGEST_HANDLERS,
      inject: handlers,
      useFactory: (...instances: AnyIngestHandler[]) => instances,
    },
    IngestService,
  ],
})
export class IngestModule {}
