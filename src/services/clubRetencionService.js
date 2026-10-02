import {
  Clubs,
  ClubDivisiones,
  ClubMiembros,
  User,
  sequelize,
} from '../db/db.js';
import { usuarioEsAdminClub } from './clubsService.js';

function parseWeekAnchor(semanaRaw) {
  const raw = String(semanaRaw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, status: 400, error: 'semana debe ser YYYY-MM-DD' };
  }
  const anchor = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(anchor.getTime())) {
    return { ok: false, status: 400, error: 'semana inválida' };
  }
  const day = anchor.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const inicio = new Date(anchor);
  inicio.setUTCDate(anchor.getUTCDate() - diffToMonday);
  inicio.setUTCHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setUTCDate(inicio.getUTCDate() + 7);
  return {
    ok: true,
    semana_inicio: inicio.toISOString().slice(0, 10),
    inicio,
    fin,
  };
}

function listMondaysFromDate(startDate, endDate) {
  const mondays = [];
  const cursor = new Date(startDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const day = cursor.getUTCDay();
  cursor.setUTCDate(cursor.getUTCDate() - ((day + 6) % 7));

  while (cursor <= endDate) {
    mondays.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return mondays;
}

async function assertPuedeVerMetricasRetencion(clubId, userId) {
  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id', 'creado_at'] });
  if (!club) return { ok: false, status: 404, error: 'Club no encontrado' };

  if (usuarioEsAdminClub(club, userId)) {
    return { ok: true, club };
  }

  const encargado = await ClubDivisiones.findOne({
    where: { club_id: clubId, encargado_id: userId },
    attributes: ['id'],
  });
  if (encargado) return { ok: true, club };

  return { ok: false, status: 403, error: 'Sin permiso para ver métricas de retención' };
}

async function contarMiembrosActivosClub(clubId) {
  return ClubMiembros.count({
    where: { club_id: clubId, estado: 'ACTIVO' },
    include: [{
      model: User,
      as: 'usuario',
      required: true,
      where: { es_dato_prueba: false },
      attributes: [],
    }],
  });
}

async function contarMiembrosConActividadSemana(clubId, inicio, fin) {
  const rows = await sequelize.query(
    `
    SELECT COUNT(DISTINCT e.usuario_id)::int AS total
    FROM user_activity_events e
    INNER JOIN club_miembros cm
      ON cm.usuario_id = e.usuario_id
      AND cm.club_id = :clubId
      AND cm.estado = 'ACTIVO'
    INNER JOIN "user" u ON u.id = e.usuario_id AND u.es_dato_prueba = FALSE
    WHERE e.occurred_at >= :inicio AND e.occurred_at < :fin
    `,
    {
      replacements: { clubId, inicio, fin },
      type: sequelize.QueryTypes.SELECT,
    },
  );
  return rows[0]?.total ?? 0;
}

async function calcularSemanaRetencion(clubId, inicio, fin) {
  const [totalMiembros, miembrosActivosSemana] = await Promise.all([
    contarMiembrosActivosClub(clubId),
    contarMiembrosConActividadSemana(clubId, inicio, fin),
  ]);

  const porcentaje = totalMiembros > 0
    ? Math.round((miembrosActivosSemana / totalMiembros) * 1000) / 10
    : 0;

  return {
    semana_inicio: inicio.toISOString().slice(0, 10),
    semana_fin: new Date(fin.getTime() - 1).toISOString().slice(0, 10),
    total_miembros: totalMiembros,
    miembros_con_actividad_social: miembrosActivosSemana,
    porcentaje_retencion_social: porcentaje,
  };
}

export async function obtenerMetricasRetencionSemana(clubId, userId, semanaRaw) {
  const auth = await assertPuedeVerMetricasRetencion(clubId, userId);
  if (!auth.ok) return auth;

  const week = parseWeekAnchor(semanaRaw);
  if (!week.ok) return week;

  const data = await calcularSemanaRetencion(clubId, week.inicio, week.fin);
  return { ok: true, data };
}

export async function obtenerMetricasRetencionHistorico(clubId, userId) {
  const auth = await assertPuedeVerMetricasRetencion(clubId, userId);
  if (!auth.ok) return auth;

  const club = auth.club;
  const clubStart = new Date(club.creado_at);
  const now = new Date();

  const firstMonday = listMondaysFromDate(clubStart, now)[0] ?? listMondaysFromDate(now, now)[0];
  const mondays = listMondaysFromDate(firstMonday, now);

  const semanas = [];
  for (const monday of mondays) {
    const inicio = new Date(monday);
    const fin = new Date(inicio);
    fin.setUTCDate(inicio.getUTCDate() + 7);
    semanas.push(await calcularSemanaRetencion(clubId, inicio, fin));
  }

  return {
    ok: true,
    data: {
      club_id: clubId,
      desde: clubStart.toISOString(),
      semanas,
    },
  };
}
