import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app/app.module.js';

async function bootstrap() {
  // Better Auth reads raw request bodies; AuthModule re-adds JSON parsing for every other route.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // The ingress keeps the /api prefix, so routes here match the public URLs.
  app.setGlobalPrefix('api');
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
