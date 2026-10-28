import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ORPCModule } from '@orpc/nest';
import { DatabaseModule } from '../database/database.module.js';
import { GroupGateway } from '../group/group.gateway.js';
import { HealthController } from '../health/health.controller.js';
import { IngestModule } from '../ingest/ingest.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ORPCModule.forRoot({}),
    IngestModule,
  ],
  controllers: [HealthController],
  providers: [GroupGateway],
})
export class AppModule {}
