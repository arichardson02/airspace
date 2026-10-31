import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { contract } from '@fs-career/contracts';
import { IngestService } from './ingest.service.js';

@Controller()
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  // The global auth guard rejects requests without a session before this runs.
  @Implement(contract.ingest.batch)
  batch(@Session() session: UserSession) {
    return implement(contract.ingest.batch).handler(async ({ input }) => ({
      accepted: await this.ingestService.ingest(input, session.user.id),
    }));
  }
}
