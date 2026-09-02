/**
 * Simula un set completo punto a punto contra el partido real #19.
 * Incluye: puntos de jugador, error rival, un cambio, deshacer y cierre de set.
 *
 * Uso: node scripts/test-eventos-punto-set.mjs
 */
import sequelize from '../src/config/database.js';
import {
  Partidos,
  MarcadoresDetalle,
  EventosPartido,
  PartidoNominas,
  PartidoParticipantes
} from '../src/db/db.js';
import {
  ejecutarRegistrarPunto,
  ejecutarDeshacerUltimoPunto,
  ejecutarRegistrarCambio,
  ejecutarActualizarDetalleEvento
} from '../src/services/eventosPartidoService.js';

const PARTIDO_ID = 19;
const ARBITRO_USER_ID = 14;

const log = (titulo, data) => {
  console.log(`\n--- ${titulo} ---`);
  console.log(JSON.stringify(data, null, 2));
};

const imprimirMarcador = (etiqueta, resultado) => {
  if (resultado.status !== 200) {
    console.log(`${etiqueta}: ERROR →`, resultado.message);
    return;
  }

  const m = resultado.marcador;
  console.log(
    `${etiqueta}: set ${m.puntos_favor}-${m.puntos_contra} | ` +
      `sets ${m.sets_ganados_local}-${m.sets_ganados_visitante} | ` +
      `resultado_principal=${m.resultado_principal}`
  );
};

const resetearMarcadorPartido = async (partidoId) => {
  await EventosPartido.destroy({ where: { partido_id: partidoId } });

  const marcador = await MarcadoresDetalle.findOne({ where: { partido_id: partidoId } });

  if (marcador) {
    await marcador.update({
      resultado_principal: 0,
      sets_ganados_local: 0,
      sets_ganados_visitante: 0,
      puntos_favor: 0,
      puntos_contra: 0,
      metrica_estructura: {},
      ultimo_evento_id: null,
      actualizado_en: new Date()
    });
  }

  await Partidos.update(
    {
      state: 'EN_CURSO',
      score_local_final: null,
      score_visitante_final: null
    },
    { where: { id: partidoId } }
  );
};

const obtenerContextoNomina = async (partidoId) => {
  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id', 'es_local']
  });

  const localTeamId = participantes.find((p) => p.es_local)?.team_id;
  const visitanteTeamId = participantes.find((p) => !p.es_local)?.team_id;

  const nominas = await PartidoNominas.findAll({
    where: { partido_id: partidoId, estado_validacion: 'VALIDADO' },
    attributes: ['user_id', 'team_id', 'rol_nomina', 'dorsal'],
    order: [['team_id', 'ASC'], ['dorsal', 'ASC']]
  });

  const titularLocal = nominas.find(
    (n) => n.team_id === localTeamId && n.rol_nomina === 'TITULAR'
  );
  const titularVisitante = nominas.find(
    (n) => n.team_id === visitanteTeamId && n.rol_nomina === 'TITULAR'
  );
  const suplenteLocal = nominas.find(
    (n) => n.team_id === localTeamId && n.rol_nomina === 'SUPLENTE'
  );

  return {
    localTeamId,
    visitanteTeamId,
    titularLocal,
    titularVisitante,
    suplenteLocal,
    totalNominas: nominas.length
  };
};

try {
  console.log('=== test-eventos-punto-set (partido #19) ===\n');

  const partido = await Partidos.findByPk(PARTIDO_ID, {
    attributes: ['id', 'state', 'arbitro_asignado_id']
  });

  if (!partido) {
    throw new Error(`Partido #${PARTIDO_ID} no encontrado`);
  }

  console.log('Partido:', partido.toJSON());

  if (partido.arbitro_asignado_id !== ARBITRO_USER_ID) {
    console.warn(
      `Aviso: árbitro del partido es ${partido.arbitro_asignado_id}, script usa userId=${ARBITRO_USER_ID}`
    );
  }

  const nominaCtx = await obtenerContextoNomina(PARTIDO_ID);
  log('Nómina validada', nominaCtx);

  if (!nominaCtx.titularLocal || !nominaCtx.titularVisitante) {
    throw new Error('Se necesitan titulares validados en ambos equipos');
  }

  await resetearMarcadorPartido(PARTIDO_ID);
  console.log(`\nPartido #${PARTIDO_ID} reseteado a 0-0 (sets 0-0), state=EN_CURSO`);

  // 1) Punto local por jugador
  let r = await ejecutarRegistrarPunto(PARTIDO_ID, ARBITRO_USER_ID, {
    equipo: 'LOCAL',
    origen: 'JUGADOR',
    jugador_id: nominaCtx.titularLocal.user_id
  });
  imprimirMarcador('Punto 1 — LOCAL jugador', r);
  log('Evento', r.evento?.detalle_json);

  // 2) Detalle opcional tipo acción
  if (r.evento?.id) {
    const det = await ejecutarActualizarDetalleEvento(PARTIDO_ID, r.evento.id, ARBITRO_USER_ID, {
      tipo_accion: 'ATAQUE'
    });
    log('Detalle ATAQUE agregado', det.evento?.detalle_json);
  }

  // 3) Punto visitante error rival
  r = await ejecutarRegistrarPunto(PARTIDO_ID, ARBITRO_USER_ID, {
    equipo: 'VISITANTE',
    origen: 'ERROR_RIVAL',
    jugador_id: null,
    tipo_error_rival: 'FUERA'
  });
  imprimirMarcador('Punto 2 — VISITANTE error rival', r);

  // 4) Rachas alternadas hasta acercarnos al cierre
  const secuencia = [
    { equipo: 'LOCAL', origen: 'JUGADOR', jugador_id: nominaCtx.titularLocal.user_id },
    { equipo: 'LOCAL', origen: 'JUGADOR', jugador_id: nominaCtx.titularLocal.user_id },
    { equipo: 'VISITANTE', origen: 'JUGADOR', jugador_id: nominaCtx.titularVisitante.user_id },
    { equipo: 'LOCAL', origen: 'ERROR_RIVAL', jugador_id: null },
    { equipo: 'VISITANTE', origen: 'JUGADOR', jugador_id: nominaCtx.titularVisitante.user_id }
  ];

  for (let i = 0; i < secuencia.length; i += 1) {
    r = await ejecutarRegistrarPunto(PARTIDO_ID, ARBITRO_USER_ID, secuencia[i]);
    imprimirMarcador(`Punto extra ${i + 3}`, r);
  }

  // 5) Cambio local (si hay suplente)
  if (nominaCtx.suplenteLocal) {
    const cambio = await ejecutarRegistrarCambio(PARTIDO_ID, ARBITRO_USER_ID, {
      equipo: 'LOCAL',
      jugador_sale_id: nominaCtx.titularLocal.user_id,
      jugador_entra_id: nominaCtx.suplenteLocal.user_id
    });
    log('Cambio LOCAL', cambio.evento?.detalle_json);
    imprimirMarcador('Tras cambio (marcador sin cambio)', cambio);
  } else {
    console.log('\n(Sin suplente local validado — se omite cambio)');
  }

  // 6) Deshacer último punto
  const deshacer = await ejecutarDeshacerUltimoPunto(PARTIDO_ID, ARBITRO_USER_ID);
  imprimirMarcador('Tras deshacer último punto', deshacer);
  log('Anulación', deshacer.evento?.detalle_json);

  // 7) Completar set: llevar LOCAL a 25 con ventaja >= 2
  const marcadorActual = await MarcadoresDetalle.findOne({ where: { partido_id: PARTIDO_ID } });
  let puntosLocal = marcadorActual.puntos_favor;
  let puntosVisitante = marcadorActual.puntos_contra;

  console.log(`\n--- Completando set desde ${puntosLocal}-${puntosVisitante} ---`);

  while (puntosLocal < 25 || puntosLocal - puntosVisitante < 2) {
    r = await ejecutarRegistrarPunto(PARTIDO_ID, ARBITRO_USER_ID, {
      equipo: 'LOCAL',
      origen: 'JUGADOR',
      jugador_id: nominaCtx.suplenteLocal?.user_id ?? nominaCtx.titularLocal.user_id
    });

    if (r.status !== 200) {
      throw new Error(`Fallo al cerrar set: ${r.message}`);
    }

    puntosLocal = r.marcador.puntos_favor;
    puntosVisitante = r.marcador.puntos_contra;

    if (r.marcador.sets_ganados_local > marcadorActual.sets_ganados_local) {
      console.log(`Set cerrado: parcial registrado, nuevo set ${puntosLocal}-${puntosVisitante}`);
      break;
    }
  }

  imprimirMarcador('Set 1 cerrado', r);

  const estadoFinal = await Partidos.findByPk(PARTIDO_ID, {
    attributes: ['id', 'state', 'score_local_final', 'score_visitante_final']
  });
  const marcadorFinal = await MarcadoresDetalle.findOne({ where: { partido_id: PARTIDO_ID } });
  const totalEventos = await EventosPartido.count({ where: { partido_id: PARTIDO_ID } });

  log('Estado partido', estadoFinal?.toJSON());
  log('Marcador final', marcadorFinal?.toJSON());
  console.log(`\nTotal eventos registrados: ${totalEventos}`);

  if (marcadorFinal.sets_ganados_local === 1 && marcadorFinal.puntos_favor === 0 && marcadorFinal.puntos_contra === 0) {
    console.log('✓ Set cerrado automáticamente: sets 1-0, nuevo set en 0-0');
  } else {
    console.error('✗ El cierre de set no dejó el marcador esperado');
    process.exitCode = 1;
  }

  console.log('\n=== Fin test-eventos-punto-set ===');
} catch (error) {
  console.error('Error:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
