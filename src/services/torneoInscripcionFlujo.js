import { Partidos, TorneoInscripcion, Torneos, GrupoEquipos, GrupoDivision, FaseTorneo } from '../db/db.js';
import { contarInscripcionesAceptadas } from './torneoInscripcionValidaciones.js';

const ESTADOS_PRE_INICIO = ['PLANEACION', 'INSCRIPCIONES'];

export const inscripcionesAbiertasEnTorneo = (torneo) => {
  if (!torneo || !ESTADOS_PRE_INICIO.includes(torneo.estado)) return false;
  return torneo.inscripciones_abiertas !== false;
};

export const cerrarInscripcionesTorneo = async (torneo) => {
  if (!torneo?.id) return;
  if (torneo.inscripciones_abiertas === false) return;
  await Torneos.update(
    { inscripciones_abiertas: false },
    { where: { id: torneo.id } }
  );
  torneo.inscripciones_abiertas = false;
};

export const reabrirInscripcionesSiHayCupo = async (torneoId) => {
  const torneo = await Torneos.findByPk(torneoId, {
    attributes: ['id', 'estado', 'max_equipos', 'inscripciones_abiertas'],
  });
  if (!torneo || !ESTADOS_PRE_INICIO.includes(torneo.estado)) return;
  if (torneo.inscripciones_abiertas !== false) return;

  if (torneo.max_equipos == null) return;

  const aceptadas = await contarInscripcionesAceptadas(torneoId);
  if (aceptadas < torneo.max_equipos) {
    await torneo.update({ inscripciones_abiertas: true });
  }
};

export const maybeCerrarInscripcionesPorCupo = async (torneo) => {
  if (!torneo?.max_equipos) return;
  const aceptadas = await contarInscripcionesAceptadas(torneo.id);
  if (aceptadas >= torneo.max_equipos) {
    await cerrarInscripcionesTorneo(torneo);
  }
};

export const validarTorneoPermiteBajaEquipo = async (torneo) => {
  if (!ESTADOS_PRE_INICIO.includes(torneo.estado)) {
    return {
      status: 400,
      message: 'No se puede modificar la nómina: el torneo ya comenzó',
    };
  }

  const partidos = await Partidos.count({ where: { torneo_id: torneo.id } });
  if (partidos > 0) {
    return {
      status: 400,
      message: 'No se puede salir: ya se generó el calendario de partidos',
    };
  }

  return null;
};

export const quitarEquipoDeGruposTorneo = async (torneoId, teamId) => {
  const fases = await FaseTorneo.findAll({
    where: { torneo_id: torneoId },
    attributes: ['id'],
  });
  const faseIds = fases.map((f) => f.id);
  if (!faseIds.length) return;

  const grupos = await GrupoDivision.findAll({
    where: { fase_torneo_id: faseIds },
    attributes: ['id'],
  });
  const grupoIds = grupos.map((g) => g.id);
  if (!grupoIds.length) return;

  await GrupoEquipos.destroy({
    where: { grupo_division_id: grupoIds, team_id: teamId },
  });
};

export const eliminarInscripcionAceptada = async (inscripcion, torneo) => {
  await quitarEquipoDeGruposTorneo(torneo.id, inscripcion.team_id);
  await inscripcion.destroy();
  await reabrirInscripcionesSiHayCupo(torneo.id);
};
