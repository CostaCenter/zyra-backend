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

// Prioridad: variables de Railway dashboard > railway.production.env > .env local
applyEnvFile('railway.production.env');
applyEnvFile('.env');
