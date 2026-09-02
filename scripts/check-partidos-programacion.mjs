import sequelize from '../src/config/database.js';
import { obtenerPerfilPublicoTorneo } from '../src/services/torneoPerfilService.js';

const torneoId = Number(process.argv[2] ?? 20);
const mode = process.argv[3] ?? 'one';

if (mode === 'all') {
  const [rows] = await sequelize.query(`
    SELECT torneo_id,
      COUNT(*)::int AS total,
      COUNT(datetime)::int AS con_datetime,
      COUNT(cancha_id)::int AS con_cancha
    FROM partidos
    WHERE torneo_id IS NOT NULL
    GROUP BY torneo_id
    ORDER BY torneo_id DESC
    LIMIT 15
  `);
  console.log('\n=== Torneos con partidos ===');
  console.table(rows);
  await sequelize.close();
  process.exit(0);
}

const [rows] = await sequelize.query(`
  SELECT id, jornada, grupo_division_id, datetime, cancha_id, state
  FROM partidos
  WHERE torneo_id = :torneoId
  ORDER BY jornada, id
  LIMIT 12
`, { replacements: { torneoId } });

console.log('\n=== DB partidos (torneo', torneoId, ') ===');
console.table(rows);

const [stats] = await sequelize.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(datetime)::int AS con_datetime,
    COUNT(cancha_id)::int AS con_cancha
  FROM partidos WHERE torneo_id = :torneoId
`, { replacements: { torneoId } });
console.log('\nStats DB:', stats[0]);

const perfil = await obtenerPerfilPublicoTorneo(torneoId, 1);
const conProgramacion = (perfil?.partidos ?? []).filter(
  (p) => p.fecha_hora_programada || p.cancha_asignada
);
console.log('\n=== API perfil ===');
console.log('Total partidos:', perfil?.partidos?.length ?? 0);
console.log('Con programación en API:', conProgramacion.length);
if (conProgramacion[0]) {
  console.log('Ejemplo:', JSON.stringify(conProgramacion[0], null, 2));
} else {
  console.log('Ejemplo sin programación:', JSON.stringify(perfil?.partidos?.[0], null, 2));
}

await sequelize.close();
