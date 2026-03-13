import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';
import { config as loadEnv } from 'dotenv';

const nodeEnv = process.env.NODE_ENV ?? 'development';
loadEnv({ path: `.env.${nodeEnv}` });
loadEnv({ path: '.env' });

const config: PostgresConnectionOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: +(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'mediumclone',
  password: process.env.DB_PASSWORD ?? '123',
  database: process.env.DB_DATABASE ?? 'mediumclone',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: false,
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
};

export default config;
