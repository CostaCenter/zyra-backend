import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/012_publicaciones_perfil.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('Migración 012 aplicada correctamente.');

  const checks = [
    ['publicaciones', 'publicaciones'],
    ['publicacion_deportes', 'publicacion_deportes'],
    ['publicacion_etiquetas', 'publicacion_etiquetas'],
    ['seguidores', 'seguidores'],
    ['user.bio', `"user"`, 'bio'],
    ['user.deporte_principal_id', `"user"`, 'deporte_principal_id']
  ];

  for (const [label, table, column] of checks) {
    const tableName = column ? table : `'${table}'`;
    const query = column
      ? `SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName.replace(/"/g, '')} AND column_name = '${column}'`
      : `SELECT table_name FROM information_schema.tables WHERE table_name = '${table}'`;

    const [rows] = await sequelize.query(query);
    console.log(`${label}:`, rows.length ? 'OK' : 'FALTA');
  }
} catch (error) {
  console.error('Error aplicando migración:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
