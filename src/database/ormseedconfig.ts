import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';
import ormconfig from './ormconfig';

const ormseedconfig: PostgresConnectionOptions = {
  ...ormconfig,
  migrations: [__dirname + '/../seeds/*{.ts,.js}'],
};

export default ormseedconfig;
