if (!process.env.IS_TS_NODE) {
  require('module-alias/register');
}

import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';

const nodeEnv = process.env.NODE_ENV ?? 'development';
config({ path: `.env.${nodeEnv}` });
config({ path: '.env' });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
