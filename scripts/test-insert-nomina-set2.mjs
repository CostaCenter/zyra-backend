import { PartidoNominas, sequelize } from '../src/db/db.js';

const partidoId = 153;
const teamId = 40;
const setNumero = 2;

const jugadores = [
  { user_id: 1, dorsal: 1, rol_nomina: 'TITULAR', zona: 1 },
  { user_id: 136, dorsal: 3, rol_nomina: 'TITULAR', zona: 2 },
  { user_id: 137, dorsal: 4, rol_nomina: 'TITULAR', zona: 3 },
  { user_id: 139, dorsal: 6, rol_nomina: 'TITULAR', zona: 4 },
  { user_id: 138, dorsal: 5, rol_nomina: 'TITULAR', zona: 5 },
  { user_id: 142, dorsal: 9, rol_nomina: 'TITULAR', zona: 6 },
];

try {
  await sequelize.transaction(async (transaction) => {
    await PartidoNominas.destroy({
      where: { partido_id: partidoId, team_id: teamId, set_numero: setNumero },
      transaction,
    });
    for (const j of jugadores) {
      await PartidoNominas.create(
        {
          partido_id: partidoId,
          team_id: teamId,
          user_id: j.user_id,
          dorsal: j.dorsal,
          rol_nomina: j.rol_nomina,
          zona: j.zona,
          set_numero: setNumero,
          propuesto_por_id: 1,
          estado_validacion: 'PENDIENTE',
        },
        { transaction }
      );
    }
  });
  console.log('OK: insert set 2 team 40');
  await PartidoNominas.destroy({ where: { partido_id: partidoId, team_id: teamId, set_numero: setNumero } });
  console.log('Cleaned up test rows');
} catch (error) {
  console.error('FAIL:', error.name, error.message);
  console.error('parent:', error?.parent?.constraint, error?.fields);
} finally {
  await sequelize.close();
}
