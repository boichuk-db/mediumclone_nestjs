import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';
import ormconfig from './ormconfig';

const ormseedconfig: PostgresConnectionOptions = {
  ...ormconfig,
  migrations: ['src/seeds/*.ts'],
};

export default ormseedconfig;
