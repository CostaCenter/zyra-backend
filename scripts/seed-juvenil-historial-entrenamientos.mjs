/**
 * Seed de entrenamientos históricos para división Juvenil (Zyra Club):
 * - Lun/Mié, 2× por semana, últimos 3 meses
 * - Asistencia, evaluaciones con todas las métricas de vóley
 * - Fogueos finalizados con nóminas y stats
 *
 * Ejecutar: node scripts/seed-juvenil-historial-entrenamientos.mjs
 */
import sequelize from '../src/config/database.js';
import {
  ClubEventos,
  ClubEventoAsistencias,
  ClubEventoConfirmaciones,
  ClubEventoEvaluacion,
  ClubEventoEvaluacionDetalle,
  ClubMetricaEvaluacion,
  Partidos,
  PartidoParticipantes,
  PartidoNominas,
  PartidoJugadorStats,
  Team,
} from '../src/db/db.js';

const SEED_MARKER = '[SEED-JUV]';
const ENFOQUES = [
  'Técnico/Fundamentos',
  'Físico',
  'Táctico/Sistema de juego',
  'Fogueo/Amistoso interno',
];
const ENFOQUE_FOGUEO = 'Fogueo/Amistoso interno';
const METRICAS_LABELS = [
  'Precisión en recepción de saque',
  'Consistencia en el saque',
  'Calidad y limpieza en la colocación',
  'Control y dirección del remate',
  'Efectividad en defensa de campo',
  'Postura y lectura previa',
  'Velocidad de transición',
  'Cobertura a los compañeros',
  'Comunicación en cancha',
  'Actitud defensiva / Esfuerzo en balones divididos',
];

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function generateTrainingDates(startDate, endDate) {
  const dates = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow === 1 || dow === 3) {
      const dt = new Date(cursor);
      dt.setHours(18, 0, 0, 0);
      dates.push(dt);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function seedScore(usuarioId, sessionIndex, metricaId) {
  const base = 52 + ((usuarioId * 7 + metricaId * 11 + sessionIndex * 3) % 32);
  const trend = Math.min(18, sessionIndex * 0.55);
  const jitter = ((usuarioId + sessionIndex) % 5) - 2;
  return Math.min(97, Math.max(40, Math.round(base + trend + jitter)));
}

function resolveAsistencia(usuarioId, sessionIndex) {
  const mod = (usuarioId * 13 + sessionIndex * 5) % 100;
  if (mod < 8) return 'AUSENTE';
  if (mod < 12) return 'JUSTIFICADO';
  return 'PRESENTE';
}

function splitBandos(usuarioIds) {
  const sorted = [...usuarioIds].sort((a, b) => a - b);
  const mitad = Math.ceil(sorted.length / 2);
  return { bandoA: sorted.slice(0, mitad), bandoB: sorted.slice(mitad) };
}

async function cleanupPreviousSeed(divisionId, transaction) {
  const [eventos] = await sequelize.query(
    `SELECT id, partido_id FROM club_eventos
     WHERE club_division_id = :divisionId
       AND tipo = 'ENTRENAMIENTO'
       AND titulo LIKE :marker`,
    { replacements: { divisionId, marker: `${SEED_MARKER}%` }, transaction },
  );

  if (!eventos.length) return 0;

  const eventoIds = eventos.map((e) => e.id);
  const partidoIds = [...new Set(eventos.map((e) => e.partido_id).filter(Boolean))];

  await sequelize.query(
    `DELETE FROM club_evento_evaluacion_detalle
     WHERE evaluacion_id IN (
       SELECT id FROM club_evento_evaluacion WHERE evento_id = ANY(:eventoIds)
     )`,
    { replacements: { eventoIds }, transaction },
  );
  await sequelize.query(
    'DELETE FROM club_evento_evaluacion WHERE evento_id = ANY(:eventoIds)',
    { replacements: { eventoIds }, transaction },
  );
  await sequelize.query(
    'DELETE FROM club_evento_asistencias WHERE evento_id = ANY(:eventoIds)',
    { replacements: { eventoIds }, transaction },
  );
  await sequelize.query(
    'DELETE FROM club_evento_confirmaciones WHERE evento_id = ANY(:eventoIds)',
    { replacements: { eventoIds }, transaction },
  );
  await sequelize.query(
    'DELETE FROM club_eventos WHERE id = ANY(:eventoIds)',
    { replacements: { eventoIds }, transaction },
  );

  if (partidoIds.length) {
    await sequelize.query(
      'DELETE FROM partido_jugador_stats WHERE partido_id = ANY(:partidoIds)',
      { replacements: { partidoIds }, transaction },
    );
    await sequelize.query(
      'DELETE FROM partido_nominas WHERE partido_id = ANY(:partidoIds)',
      { replacements: { partidoIds }, transaction },
    );
    await sequelize.query(
      'DELETE FROM partido_participantes WHERE partido_id = ANY(:partidoIds)',
      { replacements: { partidoIds }, transaction },
    );
    await sequelize.query(
      'DELETE FROM partidos WHERE id = ANY(:partidoIds)',
      { replacements: { partidoIds }, transaction },
    );
  }

  return eventos.length;
}

async function main() {
  const [clubRows] = await sequelize.query(
    "SELECT id, nombre, admin_id, sport_id FROM clubs WHERE nombre ILIKE '%Zyra Club%' LIMIT 1",
  );
  const club = clubRows[0];
  if (!club) throw new Error('No se encontró Zyra Club');

  const [divisionRows] = await sequelize.query(
    `SELECT id, nombre FROM club_divisiones
     WHERE club_id = :clubId AND nombre ILIKE '%Juvenil%' LIMIT 1`,
    { replacements: { clubId: club.id } },
  );
  const division = divisionRows[0];
  if (!division) throw new Error('No se encontró la división Juvenil');

  const [atletaRows] = await sequelize.query(
    `SELECT cda.usuario_id, u.name
     FROM club_division_atletas cda
     JOIN "user" u ON u.id = cda.usuario_id
     WHERE cda.club_division_id = :divisionId
     ORDER BY cda.id`,
    { replacements: { divisionId: division.id } },
  );
  if (!atletaRows.length) throw new Error('La división Juvenil no tiene atletas');

  const equipo = await Team.findOne({
    where: { club_id: club.id, club_division_id: division.id },
    attributes: ['id', 'sport_id'],
    order: [['id', 'ASC']],
  });
  if (!equipo) throw new Error('La división Juvenil no tiene equipo');

  const metricasDb = await ClubMetricaEvaluacion.findAll({
    where: { sport_id: club.sport_id },
    order: [['categoria', 'ASC'], ['nombre_metrica', 'ASC']],
  });

  const metricasByNombre = new Map(
    metricasDb.map((m) => [m.nombre_metrica, m]),
  );

  const metricas = METRICAS_LABELS.map((label) => metricasByNombre.get(label)).filter(Boolean);
  if (metricas.length < METRICAS_LABELS.length) {
    const faltantes = METRICAS_LABELS.filter((l) => !metricasByNombre.has(l));
    console.warn('Métricas faltantes en BD (se omiten):', faltantes);
  }
  if (!metricas.length) throw new Error('No hay métricas de evaluación en BD');

  const evaluadorId = club.admin_id;
  const usuarioIds = atletaRows.map((a) => a.usuario_id);
  const hoy = new Date();
  const inicio = addMonths(hoy, 3);
  const fechas = generateTrainingDates(inicio, hoy);

  console.log(`Club: ${club.nombre} (#${club.id})`);
  console.log(`División: ${division.nombre} (#${division.id})`);
  console.log(`Atletas: ${usuarioIds.length}`);
  console.log(`Métricas: ${metricas.length}`);
  console.log(`Sesiones a crear: ${fechas.length} (${inicio.toISOString().slice(0, 10)} → ${hoy.toISOString().slice(0, 10)})`);

  const resumen = await sequelize.transaction(async (transaction) => {
    const eliminados = await cleanupPreviousSeed(division.id, transaction);
    let eventosCreados = 0;
    let evaluacionesCreadas = 0;
    let fogueosCreados = 0;

    for (let i = 0; i < fechas.length; i += 1) {
      const fechaInicio = fechas[i];
      const fechaFin = new Date(fechaInicio.getTime() + 2 * 60 * 60 * 1000);
      const enfoque = ENFOQUES[i % ENFOQUES.length];
      const esFogueo = enfoque === ENFOQUE_FOGUEO;
      const titulo = `${SEED_MARKER} Entrenamiento ${division.nombre} · ${fechaInicio.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`;

      let partidoId = null;
      if (esFogueo) {
        const partido = await Partidos.create({
          name: `${division.nombre} — fogueo interno`,
          torneo_id: null,
          fase_torneo_id: null,
          grupo_division_id: null,
          sport_id: equipo.sport_id,
          cancha_id: null,
          datetime: fechaInicio,
          state: 'FINALIZADO',
          tipo: 'AMISTOSO',
          nivel_arbitraje: 'BASICO',
          programado_por_id: evaluadorId,
          club_division_id: division.id,
          score_local_final: 2 + (i % 2),
          score_visitante_final: i % 3 === 0 ? 1 : 0,
          finalizado_en: fechaFin,
        }, { transaction });

        await PartidoParticipantes.bulkCreate([
          { partido_id: partido.id, team_id: equipo.id, es_local: true },
          { partido_id: partido.id, team_id: equipo.id, es_local: false },
        ], { transaction });

        partidoId = partido.id;
        fogueosCreados += 1;
      }

      const presentes = [];
      const asistenciaReal = [];

      for (const usuarioId of usuarioIds) {
        const estado = resolveAsistencia(usuarioId, i);
        asistenciaReal.push({ usuarioId, estado });
        if (estado === 'PRESENTE') presentes.push(usuarioId);
      }

      const asistenciaPct = Math.round((presentes.length / usuarioIds.length) * 100);

      const evento = await ClubEventos.create({
        club_division_id: division.id,
        tipo: 'ENTRENAMIENTO',
        titulo,
        descripcion: `Sesión histórica generada para pruebas (${enfoque}).`,
        fecha_hora: fechaInicio,
        fecha_hora_fin: fechaFin,
        lugar: 'Cancha principal Zyra Club',
        recurrente: false,
        dias_recurrencia: [1, 3],
        enfoque_sesion: enfoque,
        metricas_a_evaluar: METRICAS_LABELS,
        cupo_limite: null,
        indumentaria_sugerida: ['Manga corta', 'Rodilleras', 'Zapatillas indoor'],
        partido_id: partidoId,
        evento_serie_id: null,
        creado_por_id: evaluadorId,
        completado_at: fechaFin,
        asistencia_real_pct: asistenciaPct,
      }, { transaction });

      eventosCreados += 1;

      await ClubEventoConfirmaciones.bulkCreate(
        usuarioIds.map((usuarioId) => ({
          evento_id: evento.id,
          usuario_id: usuarioId,
          respuesta: 'CONFIRMADO',
        })),
        { transaction },
      );

      await ClubEventoAsistencias.bulkCreate(
        asistenciaReal.map(({ usuarioId, estado }) => ({
          evento_id: evento.id,
          usuario_id: usuarioId,
          estado,
          registrado_por: evaluadorId,
        })),
        { transaction },
      );

      for (const usuarioId of presentes) {
        const evaluacion = await ClubEventoEvaluacion.create({
          evento_id: evento.id,
          usuario_id: usuarioId,
          evaluador_id: evaluadorId,
          notas_generales: i % 5 === 0
            ? 'Buen progreso técnico; mantener constancia en recepción.'
            : null,
        }, { transaction });

        evaluacionesCreadas += 1;

        await ClubEventoEvaluacionDetalle.bulkCreate(
          metricas.map((metrica) => ({
            evaluacion_id: evaluacion.id,
            metrica_id: metrica.id,
            calificacion: seedScore(usuarioId, i, metrica.id),
          })),
          { transaction },
        );
      }

      if (esFogueo && partidoId && presentes.length >= 4) {
        const { bandoA, bandoB } = splitBandos(presentes);
        const nominas = [];
        let dorsal = 1;
        for (const uid of bandoA) {
          const numDorsal = dorsal++;
          nominas.push({
            partido_id: partidoId,
            team_id: equipo.id,
            user_id: uid,
            dorsal: numDorsal,
            rol_nomina: numDorsal <= 6 ? 'TITULAR' : 'SUPLENTE',
            propuesto_por_id: evaluadorId,
            validado_por_id: evaluadorId,
            estado_validacion: 'VALIDADO',
            validado_at: fechaFin,
            set_numero: 1,
            es_local: true,
          });
        }
        dorsal = 1;
        for (const uid of bandoB) {
          const numDorsal = dorsal++;
          nominas.push({
            partido_id: partidoId,
            team_id: equipo.id,
            user_id: uid,
            dorsal: numDorsal,
            rol_nomina: numDorsal <= 6 ? 'TITULAR' : 'SUPLENTE',
            propuesto_por_id: evaluadorId,
            validado_por_id: evaluadorId,
            estado_validacion: 'VALIDADO',
            validado_at: fechaFin,
            set_numero: 1,
            es_local: false,
          });
        }
        await PartidoNominas.bulkCreate(nominas, { transaction });

        const stats = presentes.map((uid) => ({
          partido_id: partidoId,
          user_id: uid,
          team_id: equipo.id,
          goles: 0,
          asistencias: 0,
          amarillas: (uid + i) % 17 === 0 ? 1 : 0,
          rojas: 0,
          puntos_personales: 8 + ((uid * 3 + i * 5) % 21),
          jugo_minutos: 60,
        }));
        await PartidoJugadorStats.bulkCreate(stats, { transaction });
      }
    }

    return { eliminados, eventosCreados, evaluacionesCreadas, fogueosCreados };
  });

  console.log('\n✅ Seed completado');
  console.log(`   Eventos anteriores eliminados: ${resumen.eliminados}`);
  console.log(`   Entrenamientos creados: ${resumen.eventosCreados}`);
  console.log(`   Evaluaciones creadas: ${resumen.evaluacionesCreadas}`);
  console.log(`   Fogueos finalizados: ${resumen.fogueosCreados}`);
}

main()
  .catch((err) => {
    console.error('❌ Error en seed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
