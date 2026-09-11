import sequelize from '../src/config/database.js';

try {
  await sequelize.query(`
    ALTER TABLE club_eventos
      ADD COLUMN IF NOT EXISTS completado_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS asistencia_real_pct INTEGER
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_club_eventos_completado
      ON club_eventos (completado_at)
      WHERE completado_at IS NOT NULL
  `);
  console.log('OK: columnas completado_at y asistencia_real_pct listas');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close().catch(() => {});
}
