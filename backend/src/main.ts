import { webcrypto } from 'node:crypto';
if (!global.crypto) (global as unknown as { crypto: unknown }).crypto = webcrypto;

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 3001;

  logger.log(`Starting AIM backend on port ${port}…`);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const allowedOrigins = [
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
    'http://localhost:3000',
    'https://ai119.netlify.app',
    'https://web.telegram.org',
    'https://telegram.org',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api');

  // Raw route at /health for Railway healthcheck (bypasses global prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ status: 'ok' });
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`AIM backend running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('[FATAL] Bootstrap failed:', err);
  process.exit(1);
});
