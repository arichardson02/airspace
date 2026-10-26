import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ORPCModule } from '@orpc/nest';
import { DatabaseModule } from '../database/database.module.js';
import { IngestModule } from '../ingest/ingest.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ORPCModule.forRoot({}),
    IngestModule,
  ],
})
export class AppModule {}
