import { Controller, Inject } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { contract } from "@fs-career/contracts";
import { IngestService } from "./ingest.service.js";

/** What `@Implement(contract.ingest.batch)` needs the method to return; oRPC only exports it generically. */
type BatchProcedure = ReturnType<ReturnType<typeof implement<typeof contract.ingest.batch>>["handler"]>;

@Controller()
export class IngestController {
  // Nest injects by the runtime class; naming it here keeps the import a value import, not type-only.
  constructor(@Inject(IngestService) private readonly ingestService: IngestService) {}

  // The global auth guard rejects requests without a session before this runs.
  @Implement(contract.ingest.batch)
  batch(@Session() session: UserSession): BatchProcedure {
    return implement(contract.ingest.batch).handler(async ({ input }) => ({
      accepted: await this.ingestService.ingest(input, session.user.id),
    }));
  }
}
