import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function applyEnvFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) return;

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

// Local: solo .env (Postgres local). Railway: dashboard vars > railway.production.env
applyEnvFile('.env');
if (isRailway) {
  applyEnvFile('railway.production.env');
}
