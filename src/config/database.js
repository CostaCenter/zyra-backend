import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const pool = {
  max: 5,
  min: 0,
  acquire: 30000,
  idle: 10000,
};

const URL_ENV_KEYS = [
  'DATABASE_URL',
  'DATABASE_PRIVATE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRIVATE_URL',
];

function resolveDatabaseUrl() {
  for (const key of URL_ENV_KEYS) {
    if (process.env[key]) {
      return process.env[key];
    }
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
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const isProduction = process.env.NODE_ENV === 'production' || isRailway;

if (!databaseUrl && isProduction) {
  const dbKeys = Object.keys(process.env).filter((key) => /DATABASE|POSTGRES|^PG/i.test(key));
  console.error('❌ Falta DATABASE_URL en el servicio BACKEND de Railway (no en Postgres).');
  console.error(`   Variables DB detectadas en este contenedor: ${dbKeys.length ? dbKeys.join(', ') : '(ninguna)'}`);
  console.error('   Solución rápida → servicio backend → Variables → Raw Editor → pega railway.env.raw');
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
