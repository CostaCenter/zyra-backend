import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const pool = {
  max: 5,
  min: 0,
  acquire: 30000,
  idle: 10000,
};

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const {
    PGHOST,
    PGPORT,
    PGUSER,
    PGPASSWORD,
    PGDATABASE,
  } = process.env;

  if (PGHOST && PGUSER && PGPASSWORD && PGDATABASE) {
    const port = PGPORT || 5432;
    const user = encodeURIComponent(PGUSER);
    const password = encodeURIComponent(PGPASSWORD);
    const database = encodeURIComponent(PGDATABASE);
    return `postgresql://${user}:${password}@${PGHOST}:${port}/${database}`;
  }

  return null;
}

const databaseUrl = resolveDatabaseUrl();
const isProduction = process.env.NODE_ENV === 'production';

if (!databaseUrl && isProduction) {
  console.error(
    '❌ Falta configuración de PostgreSQL en Railway.\n'
    + '   Agrega DATABASE_URL en el servicio backend (Variables → Reference → Postgres → DATABASE_URL)\n'
    + '   o define PGHOST, PGPORT, PGUSER, PGPASSWORD y PGDATABASE.',
  );
  process.exit(1);
}

const useSsl = process.env.DB_SSL !== 'false'
  && (databaseUrl || process.env.DB_SSL === 'true');

const dialectOptions = useSsl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : undefined;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    pool,
    dialectOptions,
  })
  : new Sequelize(
    process.env.DB_NAME || 'zyra',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || '123',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      pool,
      dialectOptions,
    },
  );

export default sequelize;
