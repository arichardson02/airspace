import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ORPCModule } from "@orpc/nest";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { createAuth } from "../auth/auth.js";
import { createEmailSender } from "../auth/email.js";
import { DRIZZLE, DatabaseModule, type Database } from "../database/database.module.js";
import { GroupGateway } from "../group/group.gateway.js";
import { HealthController } from "../health/health.controller.js";
import { IngestModule } from "../ingest/ingest.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    // Registers /api/auth/* and a global guard: every route needs a session unless marked
    // @AllowAnonymous().
    AuthModule.forRootAsync({
      inject: [DRIZZLE, ConfigService],
      useFactory: (db: Database, config: ConfigService) => ({
        auth: createAuth(db, {
          baseURL: config.getOrThrow<string>("BETTER_AUTH_URL"),
          secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
          sendEmail: createEmailSender(config.get<string>("RESEND_API_KEY")),
        }),
      }),
    }),
    ORPCModule.forRoot({}),
    IngestModule,
  ],
  controllers: [HealthController],
  providers: [GroupGateway],
})
export class AppModule {}
