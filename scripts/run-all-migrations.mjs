/**
 * Aplica el esquema base (Sequelize sync) y todas las migraciones SQL en orden.
 *
 * Uso contra Railway (desde tu máquina):
 *   set DATABASE_URL=postgresql://...   (PowerShell: $env:DATABASE_URL="...")
 *   node scripts/run-all-migrations.mjs
 *
 * Requiere: npm install ya ejecutado en backend-zyra.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';
import { sequelize as dbWithModels } from '../src/db/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../src/db/migrations');

/** Orden estricto: legacy → 001…039 */
const MIGRATION_FILES = [
  'create_usuario_complejo.sql',
  'add_invitacion_fields_usuario_complejo.sql',
  'create_configuracion_horarios_favoritos.sql',
  'add_cancha_id_to_configuracion_horarios_favoritos.sql',
  'add_unique_indexes_horarios.sql',
  '001_extender_partidos_torneo.sql',
  '002_jerarquia_torneo.sql',
  '003_partido_nominas.sql',
  '004_eventos_partido.sql',
  '005_torneo_complejo_opcional.sql',
  '006_dorsales_equipo_perfil.sql',
  '007_visibilidad_torneo.sql',
  '008_torneo_inscripciones.sql',
  '009_grupo_equipos.sql',
  '010_arbitro_asignado.sql',
  '011_max_equipos_torneo.sql',
  '012_publicaciones_perfil.sql',
  '013_publicaciones_media_size.sql',
  '014_torneo_photo.sql',
  '015_es_dato_prueba.sql',
  '016_mano_habil.sql',
  '017_es_dato_prueba_partidos.sql',
  '018_datateam_descripcion.sql',
  '019_torneo_portada_flyer.sql',
  '020_partidos_jornada.sql',
  '021_torneo_orden_sorteo.sql',
  '022_torneo_arbitros.sql',
  '023_rotacion_voley.sql',
  '024_nomina_zona.sql',
  '025_torneo_plantilla_dorsales.sql',
  '026_torneo_plantilla_config.sql',
  '027_valores_puntos_accion.sql',
  '028_torneo_config_logistica.sql',
  '029_torneo_duracion_por_set.sql',
  '030_programacion_horarios_partidos.sql',
  '031_notificaciones.sql',
  '032_notificaciones_categoria.sql',
  '033_arbitro_confirmacion_estado.sql',
  '034_torneo_arbitros_confirmacion.sql',
  '035_dispositivos_push.sql',
  '036_alineacion_por_set.sql',
  '037_drop_legacy_nomina_unique_indexes.sql',
  '038_notificacion_alineacion_pendiente_set.sql',
  '039_usuario_foto_portada.sql',
];

async function runSqlFile(fileName) {
  const filePath = path.join(migrationsDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Omitida (no existe): ${fileName}`);
    return;
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`→ ${fileName}`);
  await sequelize.query(sql);
  console.log(`✓ ${fileName}`);
}

async function main() {
  console.log('1/2 Sincronizando esquema base (Sequelize models)...');
  await dbWithModels.sync({ force: false, alter: false });
  console.log('✓ Esquema base listo\n');

  console.log('2/2 Aplicando migraciones SQL...');
  for (const file of MIGRATION_FILES) {
    await runSqlFile(file);
  }

  console.log('\n✅ Todas las migraciones completadas.');
}

try {
  await main();
} catch (error) {
  console.error('\n❌ Error en migraciones:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
