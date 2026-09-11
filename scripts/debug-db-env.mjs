import '../src/config/loadEnv.js';

const host = process.env.DB_HOST || '(unset)';
const dbName = process.env.DB_NAME || '(unset)';
const hasDbUrl = Boolean(process.env.DATABASE_URL);
const dbUrlHost = (() => {
  try {
    return process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : '(none)';
  } catch {
    return '(invalid)';
  }
})();

console.log(JSON.stringify({
  DB_HOST: host,
  DB_NAME: dbName,
  hasDATABASE_URL: hasDbUrl,
  DATABASE_URL_host: dbUrlHost,
  isRailway: Boolean(process.env.RAILWAY_ENVIRONMENT),
  SEED_PRODUCTION_DATA: process.env.SEED_PRODUCTION_DATA,
}, null, 2));
