import { TorneoInscripcion } from '../db/db.js';

const ESTADOS_ABIERTOS_INSCRIPCION = ['PLANEACION', 'INSCRIPCIONES'];

export const contarInscripcionesAceptadas = (torneoId) =>
  TorneoInscripcion.count({
    where: { torneo_id: torneoId, estado: 'ACEPTADA' }
  });

export const validarTorneoAceptaInscripciones = (torneo) => {
  if (!ESTADOS_ABIERTOS_INSCRIPCION.includes(torneo.estado)) {
    return {
      status: 400,
      message: 'El torneo ya inició, no se aceptan más equipos'
    };
  }

  return null;
};

export const validarCupoDisponible = async (torneo) => {
  if (torneo.max_equipos == null) {
    return null;
  }

  const aceptadas = await contarInscripcionesAceptadas(torneo.id);

  if (aceptadas >= torneo.max_equipos) {
    return {
      status: 400,
      message: 'El torneo ya alcanzó el máximo de equipos'
    };
  }

  return null;
};
