import { sequelize } from '../db/db.js';

/**
 * Tras importar datos con IDs explícitos, las secuencias de Postgres quedan en 1
 * y los INSERT nuevos fallan con user_pkey duplicada → 500 en /auth/register.
 */
export async function resetPgSequences() {
  const [rows] = await sequelize.query(`
    SELECT c.relname AS table_name, a.attname AS column_name,
           pg_get_serial_sequence(format('%I.%I', 'public', c.relname), a.attname) AS seq
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence(format('%I.%I', 'public', c.relname), a.attname) IS NOT NULL
  `);

  for (const { table_name, column_name, seq } of rows) {
    if (!seq) continue;
    await sequelize.query(`
      SELECT setval(
        '${seq}',
        COALESCE((SELECT MAX("${column_name}") FROM "${table_name}"), 1),
        true
      )
    `);
  }

  return rows.length;
}
