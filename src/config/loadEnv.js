import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function isPlaceholderDatabaseUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.username === 'user' || parsed.password === 'password';
  } catch {
    return false;
  }
}

function applyEnvFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) return dotenv.parse('');

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return parsed;
}

const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

applyEnvFile('.env');

if (isRailway) {
  const prodEnv = applyEnvFile('railway.production.env');

  if (prodEnv.DATABASE_URL && isPlaceholderDatabaseUrl(process.env.DATABASE_URL)) {
    console.warn(
      '⚠️ DATABASE_URL en Railway es placeholder (user/password). '
      + 'Usando railway.production.env — elimina la variable incorrecta del dashboard.',
    );
    process.env.DATABASE_URL = prodEnv.DATABASE_URL;
  }
}
