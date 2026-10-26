import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@fs-career/contracts';
import { IngestService } from './ingest.service.js';

@Controller()
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Implement(contract.ingest.batch)
  batch() {
    return implement(contract.ingest.batch).handler(async ({ input }) => ({
      accepted: await this.ingestService.ingest(input),
    }));
  }
}
