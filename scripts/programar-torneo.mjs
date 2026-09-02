import sequelize from '../src/config/database.js';
import { Torneos, Partidos } from '../src/db/db.js';
import { aplicarProgramacionPartidos } from '../src/services/generadorFixture.js';
import { obtenerPerfilPublicoTorneo } from '../src/services/torneoPerfilService.js';

const torneoId = Number(process.argv[2] ?? 20);
const forzarMultiDia = process.argv.includes('--multi-dia');

const torneo = await Torneos.findByPk(torneoId);
if (!torneo) {
  console.error('Torneo no encontrado');
  process.exit(1);
}

if (forzarMultiDia && torneo.tipo_duracion === 'RELAMPAGO') {
  const base = torneo.fecha_hora_inicio
    ? new Date(torneo.fecha_hora_inicio)
    : new Date();
  const fin = new Date(base);
  fin.setDate(fin.getDate() + 3);
  await torneo.update({
    tipo_duracion: 'MULTIPLE_DIAS',
    fecha_fin: fin.toISOString().slice(0, 10),
  });
  console.log('Torneo actualizado a MULTIPLE_DIAS hasta', fin.toISOString().slice(0, 10));
  await torneo.reload();
}

const partidos = await Partidos.findAll({
  where: { torneo_id: torneoId },
  order: [['jornada', 'ASC'], ['id', 'ASC']],
});

const resultado = await aplicarProgramacionPartidos(partidos, torneo);
if (resultado.error) {
  console.error('Error:', resultado.error);
  process.exit(1);
}

console.log('OK —', resultado.asignaciones.length, 'partidos programados');

const perfil = await obtenerPerfilPublicoTorneo(torneoId, 1);
const muestra = perfil.partidos.slice(0, 3).map((p) => ({
  id: p.id,
  jornada: p.jornada,
  grupo: p.grupo?.nombre,
  fecha_hora_programada: p.fecha_hora_programada,
  cancha_asignada: p.cancha_asignada?.nombre,
}));

console.log(JSON.stringify(muestra, null, 2));

await sequelize.close();
