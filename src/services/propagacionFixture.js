import {
  sequelize,
  ProgresionFixture,
  PartidoParticipantes,
  EventosPartido
} from '../db/db.js';

export const getDefaultDeps = () => ({
  ProgresionFixture,
  PartidoParticipantes,
  EventosPartido,
  sequelize
});

/**
 * Resuelve qué team_id avanza según el resultado del partido origen.
 * resultado_principal: 1 = LOCAL ganó, -1 = VISITANTE ganó, 0 = en curso.
 */
export const determinarTeamIdAvance = (participantes, resultadoPrincipal, condicionAvance) => {
  if (resultadoPrincipal === 0) {
    return null;
  }

  const local = participantes.find((p) => p.es_local === true);
  const visitante = participantes.find((p) => p.es_local === false);

  const ladoGanador =
    resultadoPrincipal === 1 ? 'LOCAL' :
    resultadoPrincipal === -1 ? 'VISITANTE' :
    null;

  if (!ladoGanador) {
    return null;
  }

  const ladoAvance =
    condicionAvance === 'GANADOR'
      ? ladoGanador
      : ladoGanador === 'LOCAL'
        ? 'VISITANTE'
        : 'LOCAL';

  const participante = ladoAvance === 'LOCAL' ? local : visitante;
  return participante?.team_id ?? null;
};

const ERROR_DESTINO_CON_ACTIVIDAD =
  'no se puede corregir el avance: el partido destino ya tiene actividad registrada';

/**
 * Propaga el ganador/perdedor de un partido terminado hacia los partidos destino
 * definidos en progresion_fixture.
 *
 * Invocado automáticamente por el endpoint de registro de eventos cuando
 * resultado_principal !== 0 (ver decisión de arquitectura en documentación del módulo).
 */
export const propagarAvancePartido = async (
  partidoId,
  resultadoPrincipal,
  deps = getDefaultDeps()
) => {
  if (resultadoPrincipal === 0) {
    return { propagaciones: [] };
  }

  const {
    ProgresionFixture: ProgresionFixtureModel,
    PartidoParticipantes: PartidoParticipantesModel,
    EventosPartido: EventosPartidoModel,
    sequelize: sequelizeInstance
  } = deps;

  const progresiones = await ProgresionFixtureModel.findAll({
    where: { partido_origen_id: partidoId }
  });

  if (progresiones.length === 0) {
    return { propagaciones: [] };
  }

  const participantesOrigen = await PartidoParticipantesModel.findAll({
    where: { partido_id: partidoId }
  });

  try {
    const propagaciones = await sequelizeInstance.transaction(async (transaction) => {
      const resultados = [];

      for (const progresion of progresiones) {
        const teamId = determinarTeamIdAvance(
          participantesOrigen,
          resultadoPrincipal,
          progresion.condicion_avance
        );

        if (teamId == null) {
          continue;
        }

        const esLocal = progresion.posicion_destino === 'LOCAL';
        const partidoDestinoId = progresion.partido_destino_id;

        const eventosEnDestino = await EventosPartidoModel.count({
          where: { partido_id: partidoDestinoId },
          transaction
        });

        const participanteExistente = await PartidoParticipantesModel.findOne({
          where: {
            partido_id: partidoDestinoId,
            es_local: esLocal
          },
          transaction
        });

        if (participanteExistente) {
          if (participanteExistente.team_id === teamId) {
            resultados.push({
              partido_destino_id: partidoDestinoId,
              team_id: teamId,
              es_local: esLocal,
              accion: 'sin_cambios'
            });
            continue;
          }

          if (eventosEnDestino > 0) {
            throw new Error(ERROR_DESTINO_CON_ACTIVIDAD);
          }

          await participanteExistente.update({ team_id: teamId }, { transaction });
          resultados.push({
            partido_destino_id: partidoDestinoId,
            team_id: teamId,
            es_local: esLocal,
            accion: 'actualizado'
          });
          continue;
        }

        await PartidoParticipantesModel.create(
          {
            partido_id: partidoDestinoId,
            team_id: teamId,
            es_local: esLocal
          },
          { transaction }
        );

        resultados.push({
          partido_destino_id: partidoDestinoId,
          team_id: teamId,
          es_local: esLocal,
          accion: 'creado'
        });
      }

      return resultados;
    });

    return { propagaciones };
  } catch (error) {
    if (error.message === ERROR_DESTINO_CON_ACTIVIDAD) {
      return { error: ERROR_DESTINO_CON_ACTIVIDAD };
    }

    throw error;
  }
};
