import { webcrypto } from 'node:crypto';
if (!global.crypto) (global as unknown as { crypto: unknown }).crypto = webcrypto;

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`AIM backend running on port ${port}`);
}
bootstrap();
