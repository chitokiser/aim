import { webcrypto } from 'node:crypto';
if (!global.crypto) (global as unknown as { crypto: unknown }).crypto = webcrypto;

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL ?? 'http://localhost:3000',
        'https://web.telegram.org',
        'https://telegram.org',
      ];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`AIM backend running on port ${port}`);
}
bootstrap();
