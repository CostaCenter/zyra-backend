/**
 * Asegura columnas/tablas críticas de clubs en prod cuando preDeploy
 * no aplicó migraciones 040+ (p. ej. falló un SQL legacy no idempotente).
 * Cada statement es independiente e idempotente.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../db/migrations');

const CRITICAL_FILES = [
  '040_team_categoria_genero.sql',
  '041_publicacion_como_equipo.sql',
  '042_clubs.sql',
  '043_notificaciones_club.sql',
  '044_club_gestion.sql',
  '045_club_destacados.sql',
  '046_club_division_genero_null.sql',
  '047_club_division_atletas.sql',
  '048_club_division_invitaciones.sql',
  '049_club_evento_entrenamiento.sql',
  '050_interaccion_social.sql',
  '051_club_anuncios_imagen.sql',
  '052_club_evento_completado.sql',
  '053_club_membresia_solicitudes.sql',
  '054_interacciones_sociales_extension.sql',
  '055_notificaciones_vista_bandeja.sql',
];

/** Partir SQL en statements; conserva bloques DO $$ ... $$; */
function splitSqlStatements(sql) {
  const cleaned = sql
    .replace(/^\s*--.*$/gm, '')
    .trim();
  if (!cleaned) return [];

  const parts = [];
  let buf = '';
  let inDollar = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (ch === '$' && next === '$') {
      inDollar = !inDollar;
      buf += '$$';
      i += 1;
      continue;
    }

    if (ch === ';' && !inDollar) {
      const stmt = buf.trim();
      if (stmt) parts.push(stmt);
      buf = '';
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail) parts.push(tail);
  return parts;
}

function isIgnorableSchemaError(err) {
  const msg = String(err?.message || err || '');
  const code = err?.original?.code || err?.parent?.code || err?.code;
  return (
    code === '42710' // duplicate_object
    || code === '42P07' // duplicate_table
    || code === '42701' // duplicate_column
    || code === '23505' // unique_violation (backfill ya aplicado)
    || code === '23502' // not_null en backfills de datos (no debe tumbar el boot)
    || /already exists/i.test(msg)
    || /duplicate key/i.test(msg)
    || /violates not-null constraint/i.test(msg)
  );
}

function isDataBackfillStatement(statement) {
  return /^\s*INSERT\s+INTO\s+/i.test(statement);
}

export async function ensureClubSchema(sequelize) {
  let applied = 0;
  let skipped = 0;

  // Prod a veces tiene la columna sin DEFAULT a nivel PG (creada por sync).
  try {
    await sequelize.query(`
      ALTER TABLE club_miembros
        ALTER COLUMN fecha_ingreso SET DEFAULT NOW()
    `);
  } catch (err) {
    if (!isIgnorableSchemaError(err) && !/does not exist/i.test(String(err?.message || ''))) {
      console.warn('⚠️  ensureClubSchema fecha_ingreso DEFAULT:', err.message);
    }
  }

  for (const fileName of CRITICAL_FILES) {
    const filePath = path.join(migrationsDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  ensureClubSchema: no existe ${fileName}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
      try {
        await sequelize.query(statement);
        applied += 1;
      } catch (err) {
        if (isIgnorableSchemaError(err) || isDataBackfillStatement(statement)) {
          skipped += 1;
          if (isDataBackfillStatement(statement) && !isIgnorableSchemaError(err)) {
            console.warn(`⚠️  ensureClubSchema backfill omitido (${fileName}):`, err.message);
          }
          continue;
        }
        console.error(`❌ ensureClubSchema falló en ${fileName}:`, err.message);
        throw err;
      }
    }
  }

  // Verificación mínima: columnas que estaban rompiendo /api/clubs/mios
  const [rows] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Team'
      AND column_name IN ('categoria_edad', 'genero', 'club_id', 'club_division_id')
    ORDER BY column_name
  `);

  const cols = rows.map((r) => r.column_name);
  const required = ['categoria_edad', 'club_id', 'club_division_id', 'genero'];
  const missing = required.filter((c) => !cols.includes(c));
  if (missing.length) {
    throw new Error(`Team sigue sin columnas: ${missing.join(', ')}`);
  }

  console.log(
    `✅ ensureClubSchema OK (stmts ok=${applied}, ignorados=${skipped}, Team cols=${cols.join(',')})`,
  );
}
