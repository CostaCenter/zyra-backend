import sequelize from '../src/config/database.js';
import { Team, TeamMiembros, DataTeam } from '../src/db/db.js';

const USER_ID = 1;
const SPORT_ID = 1; // Futbol — el log de creación era con sport_id=1
const TEAM_NAME = 'Angeles';

try {
  const existente = await Team.findOne({ where: { name: TEAM_NAME, capitan_id: USER_ID } });
  if (existente) {
    console.log('Ya existe:', existente.id, existente.name);
    process.exit(0);
  }

  const equipo = await sequelize.transaction(async (transaction) => {
    const team = await Team.create(
      {
        name: TEAM_NAME,
        sport_id: SPORT_ID,
        capitan_id: USER_ID,
        privado: false,
        categoria_edad: null,
        genero: null,
        creado_at: new Date(),
      },
      { transaction },
    );

    await TeamMiembros.create(
      {
        team_id: team.id,
        user_id: USER_ID,
        rol: 'CAPITAN',
        estado_invitacion: 'ACEPTADO',
        fecha_union: new Date(),
      },
      { transaction },
    );

    await DataTeam.create(
      {
        team_id: team.id,
        elo: 0,
        games: 0,
        win: 0,
        lose: 0,
        draw: 0,
        total: 0,
      },
      { transaction },
    );

    return team;
  });

  console.log('✅ Equipo recreado:', { id: equipo.id, name: equipo.name, sport_id: SPORT_ID });
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
