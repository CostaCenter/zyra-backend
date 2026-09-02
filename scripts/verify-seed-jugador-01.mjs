import sequelize from '../src/config/database.js';
import { obtenerDetalleEquipoJugador } from '../src/services/statsPorPartidoService.js';

const [users] = await sequelize.query(
  `SELECT id FROM "user" WHERE nick = 'SEED_jugador_01'`
);
const [teams] = await sequelize.query(
  `SELECT id FROM "Team" WHERE name = 'SEED_FC Cordillera'`
);

const userId = users[0]?.id;
const teamId = teams[0]?.id;

if (!userId || !teamId) {
  console.error('No se encontró jugador_01 o FC Cordillera');
  process.exit(1);
}

const data = await obtenerDetalleEquipoJugador(userId, teamId);

console.log(JSON.stringify({
  totales: data.totales,
  partidos: data.partidos.length,
  detalle: data.partidos.map((p) => ({
    rival: p.rival.nombre,
    torneo: p.torneo?.nombre,
    resultado: p.resultado,
    ganado: p.ganado,
    goles: p.goles,
    asistencias: p.asistencias,
    amarillas: p.amarillas,
    rojas: p.rojas,
  })),
}, null, 2));

await sequelize.close();
