import { Op } from 'sequelize';
import {
  Clubs,
  ClubConceptosPago,
  ClubPagosMiembro,
  ClubUniformeAsignaciones,
  ClubPrendasUniforme,
  ClubUniformeHistorial,
  ClubDivisiones,
  ClubDivisionAtletas,
  ClubMiembros,
  Team,
  TeamMiembros,
  User,
} from '../db/db.js';
import {
  SISTEMAS_TALLA,
  ESTADOS_UNIFORME_ALERTA,
  tallaValidaParaSistema,
  estadoUniformeValido,
} from '../constants/clubUniformes.js';
import { parseId, usuarioPuedeGestionarClub } from './clubsService.js';
import { usuarioEsMiembroActivoClub } from './clubGestionService.js';
import {
  notificarPagoClubProximo,
  notificarPagoClubRecordatorioManual,
} from './notificacionesService.js';
import {
  addDaysToDateOnly,
  calcularDiaCorteMensual,
  calcularPrimeraFechaCorte,
  siguienteFechaCorteMensual,
  toDateOnly,
} from '../utils/mensualidadCiclo.js';

const TIPOS_CONCEPTO = ['MENSUALIDAD', 'UNIFORME', 'CUOTA_INGRESO'];
const ESTADOS_PAGO = ['PENDIENTE', 'PAGADO', 'VENCIDO', 'CORTESIA'];

const userAttrs = ['id', 'name', 'nick', 'photo', 'telefono'];

export const WHATSAPP_PAGO_PLACEHOLDERS = [
  '{nombre}',
  '{club}',
  '{concepto}',
  '{monto}',
  '{fecha_corte}',
];

export const WHATSAPP_PAGO_PLANTILLA_DEFAULT = 'Hola {nombre}, te recordamos ponerte al día con tu {concepto} en {club}. Monto: {monto}. Fecha de corte: {fecha_corte}.';

function formatConcepto(row) {
  const json = row?.toJSON ? row.toJSON() : row;
  return {
    ...json,
    monto: json.monto != null ? Number(json.monto) : 0,
    dias_gracia: json.dias_gracia != null ? Number(json.dias_gracia) : 0,
    nombre_display: json.nombre_personalizado?.trim()
      || json.tipo?.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
  };
}

function cicloCerrado(pago) {
  if (!pago) return false;
  if (pago.estado === 'VENCIDO' || pago.estado === 'CORTESIA') return true;
  if (pago.estado === 'PAGADO') return Boolean(pago.fecha_pago_real);
  return false;
}

function formatPago(row) {
  const json = row?.toJSON ? row.toJSON() : row;
  return {
    ...json,
    concepto: json.concepto ? formatConcepto(json.concepto) : null,
    usuario: json.usuario ?? null,
    registrado_por: json.registradoPor ?? null,
  };
}

function formatPrenda(row) {
  const json = row?.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    club_id: json.club_id,
    nombre: json.nombre,
    sistema_talla: json.sistema_talla,
    activo: json.activo,
  };
}

function formatAsignacion(row) {
  const json = row?.toJSON ? row.toJSON() : row;
  return {
    ...json,
    cantidad: json.cantidad != null ? Number(json.cantidad) : 1,
    entregado: Boolean(json.fecha_entrega),
    tiene_alerta: ESTADOS_UNIFORME_ALERTA.includes(json.estado_actual),
    usuario: json.usuario ?? null,
    division: json.division ?? null,
    prenda: json.prenda ? formatPrenda(json.prenda) : null,
  };
}

function formatHistorial(row) {
  const json = row?.toJSON ? row.toJSON() : row;
  return {
    ...json,
    registrado_por: json.registradoPor ?? null,
  };
}

function calcularProgresoJugador(asignaciones, totalPrendas) {
  const entregadas = asignaciones.filter((a) => a.entregado && !a.sin_asignar).length;
  const tieneAlerta = asignaciones.some((a) => a.tiene_alerta);
  return { entregadas, total: totalPrendas, tiene_alerta: tieneAlerta };
}

async function assertPuedeGestionar(clubId, userId) {
  const permisos = await usuarioPuedeGestionarClub(clubId, userId);
  if (!permisos.puede) {
    return { ok: false, status: 403, error: 'Sin permiso para gestionar pagos del club' };
  }
  return { ok: true };
}

async function assertMiembro(clubId, userId) {
  const esMiembro = await usuarioEsMiembroActivoClub(clubId, userId);
  if (!esMiembro) {
    return { ok: false, status: 403, error: 'No eres miembro de este club' };
  }
  return { ok: true };
}

export async function listarConceptosPago(clubId, userId) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  await sincronizarBackfillConceptosClub(clubId);

  const rows = await ClubConceptosPago.findAll({
    where: { club_id: clubId, activo: true },
    order: [['id', 'ASC']],
  });
  return { ok: true, data: rows.map(formatConcepto) };
}

/**
 * Misma base que Uniformes / contador de jugadores del club:
 * miembros activos + nómina de divisiones + planteles de equipos (usuario único).
 */
async function obtenerMiembrosActivosClubParaPagos(clubId) {
  const porUsuario = new Map();
  const fallbackIngreso = new Date();

  const addUsuario = (usuarioId, fechaIngreso) => {
    const id = parseId(usuarioId);
    if (!id) return;
    if (!porUsuario.has(id)) {
      porUsuario.set(id, {
        usuario_id: id,
        fecha_ingreso: fechaIngreso ?? fallbackIngreso,
      });
    }
  };

  const [miembrosClub, divisiones, equipos] = await Promise.all([
    ClubMiembros.findAll({
      where: { club_id: clubId, estado: 'ACTIVO' },
      attributes: ['usuario_id', 'fecha_ingreso'],
    }),
    ClubDivisiones.findAll({
      where: { club_id: clubId },
      attributes: ['id'],
      include: [{
        association: 'atletas',
        attributes: ['usuario_id', 'fecha_ingreso', 'estado'],
        required: false,
      }],
    }),
    Team.findAll({
      where: { club_id: clubId },
      attributes: ['id'],
    }),
  ]);

  miembrosClub.forEach((m) => addUsuario(m.usuario_id, m.fecha_ingreso));

  for (const div of divisiones) {
    for (const atleta of div.atletas ?? []) {
      if (atleta.estado === 'INACTIVO') continue;
      addUsuario(atleta.usuario_id, atleta.fecha_ingreso);
    }
  }

  if (equipos.length) {
    const teamIds = equipos.map((e) => e.id);
    const planteles = await TeamMiembros.findAll({
      where: { team_id: { [Op.in]: teamIds }, estado_invitacion: 'ACEPTADO' },
      attributes: ['user_id', 'fecha_union'],
    });
    planteles.forEach((j) => addUsuario(j.user_id, j.fecha_union));
  }

  return [...porUsuario.values()];
}

async function obtenerConceptoIngresoClub(clubId) {
  return ClubConceptosPago.findOne({
    where: { club_id: clubId, tipo: 'CUOTA_INGRESO', activo: true },
    attributes: ['id'],
  });
}

/** Sin concepto de inscripción activo, la mensualidad no depende de ningún prerrequisito. */
async function obtenerUsuariosConInscripcionCumplida(clubId, usuarioIds) {
  const ids = [...new Set((usuarioIds ?? []).map((id) => parseId(id)).filter(Boolean))];
  if (!ids.length) return new Set();

  const conceptoIngreso = await obtenerConceptoIngresoClub(clubId);
  if (!conceptoIngreso) return new Set(ids);

  const pagosOk = await ClubPagosMiembro.findAll({
    where: {
      concepto_pago_id: conceptoIngreso.id,
      usuario_id: { [Op.in]: ids },
      estado: { [Op.in]: ['PAGADO', 'CORTESIA'] },
    },
    attributes: ['usuario_id'],
  });
  return new Set(pagosOk.map((p) => p.usuario_id));
}

async function generarMensualidadesMiembro(concepto, miembro, hoyStr, { soloSiguiente = false } = {}) {
  const elegibles = await obtenerUsuariosConInscripcionCumplida(
    concepto.club_id,
    [miembro.usuario_id],
  );
  if (!elegibles.has(miembro.usuario_id)) return 0;

  const fechaIngreso = toDateOnly(miembro.fecha_ingreso);
  if (!fechaIngreso) return 0;

  const diasGracia = concepto.dias_gracia ?? 0;
  const diasAviso = concepto.dias_aviso_previo ?? 5;
  const limiteGeneracion = addDaysToDateOnly(hoyStr, diasAviso);
  const diaCorteFijo = calcularDiaCorteMensual(fechaIngreso, diasGracia);

  let generados = 0;

  if (soloSiguiente) {
    const ultimo = await ClubPagosMiembro.findOne({
      where: {
        concepto_pago_id: concepto.id,
        usuario_id: miembro.usuario_id,
      },
      order: [['fecha_corte', 'DESC']],
    });

    let nextCorte;
    if (!ultimo) {
      nextCorte = calcularPrimeraFechaCorte(fechaIngreso, diasGracia);
    } else if (!cicloCerrado(ultimo)) {
      return 0;
    } else {
      nextCorte = siguienteFechaCorteMensual(toDateOnly(ultimo.fecha_corte), diaCorteFijo);
    }

    if (!nextCorte || nextCorte > limiteGeneracion) return 0;

    const exists = await ClubPagosMiembro.findOne({
      where: {
        concepto_pago_id: concepto.id,
        usuario_id: miembro.usuario_id,
        fecha_corte: nextCorte,
      },
      attributes: ['id'],
    });
    if (exists) return 0;

    await ClubPagosMiembro.create({
      concepto_pago_id: concepto.id,
      usuario_id: miembro.usuario_id,
      fecha_corte: nextCorte,
      estado: 'PENDIENTE',
      registrado_por_id: null,
    });
    return 1;
  }

  let corte = calcularPrimeraFechaCorte(fechaIngreso, diasGracia);
  while (corte && corte <= limiteGeneracion) {
    const existing = await ClubPagosMiembro.findOne({
      where: {
        concepto_pago_id: concepto.id,
        usuario_id: miembro.usuario_id,
        fecha_corte: corte,
      },
      attributes: ['id', 'estado', 'fecha_pago_real'],
    });

    if (!existing) {
      await ClubPagosMiembro.create({
        concepto_pago_id: concepto.id,
        usuario_id: miembro.usuario_id,
        fecha_corte: corte,
        estado: 'PENDIENTE',
        registrado_por_id: null,
      });
      generados += 1;
    } else if (!cicloCerrado(existing)) {
      break;
    }

    corte = siguienteFechaCorteMensual(corte, diaCorteFijo);
  }

  return generados;
}

async function activarMensualidadesTrasInscripcion(clubId, usuarioId) {
  const concepto = await ClubConceptosPago.findOne({
    where: { club_id: clubId, tipo: 'MENSUALIDAD', activo: true },
  });
  if (!concepto) return 0;

  const miembros = await obtenerMiembrosActivosClubParaPagos(clubId);
  const miembro = miembros.find((m) => m.usuario_id === usuarioId);
  if (!miembro) return 0;

  const hoyStr = new Date().toISOString().slice(0, 10);
  return generarMensualidadesMiembro(concepto, miembro, hoyStr, { soloSiguiente: false });
}

/** Elimina mensualidades abiertas generadas antes de pagar la inscripción. */
async function limpiarMensualidadesSinInscripcion(clubId) {
  const conceptoIngreso = await obtenerConceptoIngresoClub(clubId);
  if (!conceptoIngreso) return 0;

  const conceptoMensualidad = await ClubConceptosPago.findOne({
    where: { club_id: clubId, tipo: 'MENSUALIDAD', activo: true },
    attributes: ['id'],
  });
  if (!conceptoMensualidad) return 0;

  const abiertos = await ClubPagosMiembro.findAll({
    where: {
      concepto_pago_id: conceptoMensualidad.id,
      estado: { [Op.in]: ['PENDIENTE', 'VENCIDO'] },
    },
    attributes: ['id', 'usuario_id'],
  });
  if (!abiertos.length) return 0;

  const elegibles = await obtenerUsuariosConInscripcionCumplida(
    clubId,
    abiertos.map((p) => p.usuario_id),
  );

  const idsEliminar = abiertos
    .filter((p) => !elegibles.has(p.usuario_id))
    .map((p) => p.id);

  if (!idsEliminar.length) return 0;

  await ClubPagosMiembro.destroy({ where: { id: { [Op.in]: idsEliminar } } });
  return idsEliminar.length;
}

/** Inscripción y uniforme son pagos únicos: no pasan a VENCIDO por fecha pasada. */
async function revertirVencidosPagosUnicos() {
  const conceptos = await ClubConceptosPago.findAll({
    where: { tipo: { [Op.in]: ['CUOTA_INGRESO', 'UNIFORME'] }, activo: true },
    attributes: ['id'],
  });
  const conceptoIds = conceptos.map((c) => c.id);
  if (!conceptoIds.length) return 0;

  const [revertidos] = await ClubPagosMiembro.update(
    { estado: 'PENDIENTE' },
    {
      where: {
        concepto_pago_id: { [Op.in]: conceptoIds },
        estado: 'VENCIDO',
      },
    },
  );
  return revertidos;
}

/**
 * Backfill único al crear un concepto: PENDIENTE para miembros/atletas ya existentes.
 * No reemplaza la generación automática hacia adelante (maintenance / altas nuevas).
 */
export async function backfillPagosAlCrearConcepto(concepto) {
  if (!concepto?.id || !concepto.club_id) return 0;

  const miembros = await obtenerMiembrosActivosClubParaPagos(concepto.club_id);
  if (!miembros.length) return 0;

  const hoyStr = new Date().toISOString().slice(0, 10);
  let generados = 0;

  if (concepto.tipo === 'MENSUALIDAD') {
    for (const miembro of miembros) {
      generados += await generarMensualidadesMiembro(concepto, miembro, hoyStr, {
        soloSiguiente: false,
      });
    }
    return generados;
  }

  if (concepto.tipo === 'CUOTA_INGRESO' || concepto.tipo === 'UNIFORME') {
    const existentes = await ClubPagosMiembro.findAll({
      where: { concepto_pago_id: concepto.id },
      attributes: ['usuario_id'],
    });
    const yaRegistrados = new Set(existentes.map((r) => r.usuario_id));

    const filasNuevas = [];
    for (const miembro of miembros) {
      if (yaRegistrados.has(miembro.usuario_id)) continue;

      const fechaCorte = toDateOnly(miembro.fecha_ingreso) || hoyStr;
      filasNuevas.push({
        concepto_pago_id: concepto.id,
        usuario_id: miembro.usuario_id,
        fecha_corte: fechaCorte,
        estado: 'PENDIENTE',
        registrado_por_id: null,
      });
    }

    if (filasNuevas.length) {
      const idsUsuario = [...new Set(filasNuevas.map((f) => f.usuario_id))];
      const usuariosValidos = await User.findAll({
        where: { id: { [Op.in]: idsUsuario } },
        attributes: ['id'],
      });
      const idsValidos = new Set(usuariosValidos.map((u) => u.id));
      const filasValidas = filasNuevas.filter((f) => idsValidos.has(f.usuario_id));

      if (filasValidas.length) {
        const creados = await ClubPagosMiembro.bulkCreate(filasValidas, {
          ignoreDuplicates: true,
        });
        generados += creados.length;
      }
    }
    return generados;
  }

  return 0;
}

/** Idempotente: completa pagos faltantes para conceptos ya creados (p. ej. antes del backfill). */
export async function sincronizarBackfillConceptosClub(clubId) {
  await revertirVencidosPagosUnicos();
  await limpiarMensualidadesSinInscripcion(clubId);

  const conceptos = await ClubConceptosPago.findAll({
    where: { club_id: clubId, activo: true },
  });

  let generados = 0;
  for (const concepto of conceptos) {
    try {
      generados += await backfillPagosAlCrearConcepto(concepto);
    } catch (error) {
      console.error(`[ClubPagos] backfill concepto ${concepto.id}:`, error.message || error);
    }
  }
  return generados;
}

export async function crearConceptoPago(clubId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const tipo = String(payload.tipo || '').toUpperCase();
  if (!TIPOS_CONCEPTO.includes(tipo)) {
    return { ok: false, status: 400, error: 'tipo inválido' };
  }

  const monto = Number(payload.monto ?? 0);
  if (Number.isNaN(monto) || monto < 0) {
    return { ok: false, status: 400, error: 'monto inválido' };
  }

  const dias = parseInt(payload.dias_aviso_previo ?? 5, 10);
  const createData = {
    club_id: clubId,
    tipo,
    nombre_personalizado: payload.nombre_personalizado?.trim() || null,
    monto,
    dias_aviso_previo: Number.isNaN(dias) ? 5 : Math.max(0, dias),
    activo: true,
  };

  if (tipo === 'MENSUALIDAD') {
    const diasGracia = parseInt(payload.dias_gracia ?? 0, 10);
    createData.dias_gracia = Number.isNaN(diasGracia) ? 0 : Math.max(0, diasGracia);
  }

  const duplicado = await ClubConceptosPago.findOne({
    where: { club_id: clubId, tipo, activo: true },
    attributes: ['id'],
  });
  if (duplicado) {
    return { ok: false, status: 409, error: 'Ya existe un concepto de este tipo en el club' };
  }

  const row = await ClubConceptosPago.create(createData);
  await backfillPagosAlCrearConcepto(row);
  return { ok: true, data: formatConcepto(row) };
}

export async function actualizarConceptoPago(clubId, conceptoId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const id = parseId(conceptoId);
  const row = await ClubConceptosPago.findOne({
    where: { id, club_id: clubId, activo: true },
  });
  if (!row) return { ok: false, status: 404, error: 'Concepto no encontrado' };

  if (payload.nombre_personalizado !== undefined) {
    row.nombre_personalizado = payload.nombre_personalizado?.trim() || null;
  }

  if (payload.monto != null) {
    const monto = Number(payload.monto);
    if (Number.isNaN(monto) || monto < 0) {
      return { ok: false, status: 400, error: 'monto inválido' };
    }
    row.monto = monto;
  }

  if (payload.dias_aviso_previo != null) {
    const dias = parseInt(payload.dias_aviso_previo, 10);
    row.dias_aviso_previo = Number.isNaN(dias) ? row.dias_aviso_previo : Math.max(0, dias);
  }

  if (row.tipo === 'MENSUALIDAD' && payload.dias_gracia != null) {
    const diasGracia = parseInt(payload.dias_gracia, 10);
    row.dias_gracia = Number.isNaN(diasGracia) ? row.dias_gracia : Math.max(0, diasGracia);
  }

  await row.save();
  return { ok: true, data: formatConcepto(row) };
}

export async function listarPagosMiembroClub(clubId, userId, { estado, divisionId } = {}) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  await sincronizarBackfillConceptosClub(clubId);

  const conceptos = await ClubConceptosPago.findAll({
    where: { club_id: clubId },
    attributes: ['id'],
  });
  const conceptoIds = conceptos.map((c) => c.id);
  if (!conceptoIds.length) return { ok: true, data: [] };

  const where = { concepto_pago_id: { [Op.in]: conceptoIds } };
  if (estado && ESTADOS_PAGO.includes(String(estado).toUpperCase())) {
    where.estado = String(estado).toUpperCase();
  }

  const rows = await ClubPagosMiembro.findAll({
    where,
    include: [
      {
        model: ClubConceptosPago,
        as: 'concepto',
        where: { club_id: clubId },
        required: true,
      },
      { model: User, as: 'usuario', attributes: userAttrs },
      { model: User, as: 'registradoPor', attributes: userAttrs },
    ],
    order: [['fecha_corte', 'DESC'], ['id', 'DESC']],
  });

  let data = rows.map(formatPago);
  if (divisionId) {
    const divId = parseId(divisionId);
    const atletas = await ClubDivisiones.findByPk(divId, {
      include: [{
        association: 'atletas',
        attributes: ['usuario_id'],
      }],
    });
    const ids = new Set((divId && atletas?.atletas ? atletas.atletas : []).map((a) => a.usuario_id));
    data = data.filter((p) => ids.has(p.usuario_id));
  }

  return { ok: true, data };
}

export async function registrarPagoMiembro(clubId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const conceptoId = parseId(payload.concepto_pago_id);
  const usuarioId = parseId(payload.usuario_id);
  if (!conceptoId || !usuarioId) {
    return { ok: false, status: 400, error: 'concepto_pago_id y usuario_id requeridos' };
  }

  const concepto = await ClubConceptosPago.findOne({
    where: { id: conceptoId, club_id: clubId, activo: true },
  });
  if (!concepto) return { ok: false, status: 404, error: 'Concepto no encontrado' };

  const usuario = await User.findByPk(usuarioId, { attributes: ['id'] });
  if (!usuario) return { ok: false, status: 404, error: 'Usuario no encontrado' };

  const fechaCorte = payload.fecha_corte;
  if (!fechaCorte) return { ok: false, status: 400, error: 'fecha_corte requerida' };

  const estadoInicial = payload.estado
    ? String(payload.estado).toUpperCase()
    : 'PENDIENTE';
  if (!ESTADOS_PAGO.includes(estadoInicial)) {
    return { ok: false, status: 400, error: 'estado inválido' };
  }

  if (concepto.tipo === 'CUOTA_INGRESO') {
    const previo = await ClubPagosMiembro.findOne({
      where: { concepto_pago_id: conceptoId, usuario_id: usuarioId },
      attributes: ['id'],
    });
    if (previo) {
      return {
        ok: false,
        status: 409,
        error: 'La cuota de ingreso solo se paga una vez por miembro',
      };
    }
  }

  const row = await ClubPagosMiembro.create({
    concepto_pago_id: conceptoId,
    usuario_id: usuarioId,
    fecha_corte: fechaCorte,
    estado: estadoInicial,
    fecha_pago_real: estadoInicial === 'PAGADO' ? new Date() : null,
    registrado_por_id: userId,
  });

  const full = await ClubPagosMiembro.findByPk(row.id, {
    include: [
      { model: ClubConceptosPago, as: 'concepto' },
      { model: User, as: 'usuario', attributes: userAttrs },
      { model: User, as: 'registradoPor', attributes: userAttrs },
    ],
  });

  if (
    concepto.tipo === 'CUOTA_INGRESO'
    && (estadoInicial === 'PAGADO' || estadoInicial === 'CORTESIA')
  ) {
    await activarMensualidadesTrasInscripcion(clubId, usuarioId);
  }

  return { ok: true, data: formatPago(full) };
}

export async function actualizarPagoMiembro(clubId, pagoId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const id = parseId(pagoId);
  const row = await ClubPagosMiembro.findByPk(id, {
    include: [{ model: ClubConceptosPago, as: 'concepto' }],
  });
  if (!row?.concepto || row.concepto.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Pago no encontrado' };
  }

  const nuevoEstado = payload.estado ? String(payload.estado).toUpperCase() : null;
  if (nuevoEstado && !ESTADOS_PAGO.includes(nuevoEstado)) {
    return { ok: false, status: 400, error: 'estado inválido' };
  }

  const estadoAnterior = row.estado;

  if (nuevoEstado) {
    row.estado = nuevoEstado;
    if (nuevoEstado === 'PAGADO') {
      row.fecha_pago_real = payload.fecha_pago_real ? new Date(payload.fecha_pago_real) : new Date();
    } else if (nuevoEstado === 'CORTESIA') {
      row.fecha_pago_real = null;
    } else if (nuevoEstado === 'PENDIENTE') {
      row.fecha_pago_real = null;
    }
  }

  if (payload.fecha_corte) row.fecha_corte = payload.fecha_corte;
  row.registrado_por_id = userId;
  await row.save();

  const full = await ClubPagosMiembro.findByPk(row.id, {
    include: [
      { model: ClubConceptosPago, as: 'concepto' },
      { model: User, as: 'usuario', attributes: userAttrs },
      { model: User, as: 'registradoPor', attributes: userAttrs },
    ],
  });

  const inscripcionRecienCumplida = row.concepto.tipo === 'CUOTA_INGRESO'
    && (row.estado === 'PAGADO' || row.estado === 'CORTESIA')
    && estadoAnterior !== 'PAGADO'
    && estadoAnterior !== 'CORTESIA';

  if (inscripcionRecienCumplida) {
    await activarMensualidadesTrasInscripcion(clubId, row.usuario_id);
  }

  return { ok: true, data: formatPago(full) };
}

export async function listarMisPagosClub(clubId, userId) {
  const auth = await assertMiembro(clubId, userId);
  if (!auth.ok) return auth;

  const conceptos = await ClubConceptosPago.findAll({
    where: { club_id: clubId, activo: true },
    attributes: ['id'],
  });
  const conceptoIds = conceptos.map((c) => c.id);
  if (!conceptoIds.length) return { ok: true, data: [] };

  const rows = await ClubPagosMiembro.findAll({
    where: {
      usuario_id: userId,
      concepto_pago_id: { [Op.in]: conceptoIds },
    },
    include: [{ model: ClubConceptosPago, as: 'concepto' }],
    order: [['fecha_corte', 'DESC']],
  });
  return { ok: true, data: rows.map(formatPago) };
}

export async function listarPrendasUniforme(clubId, userId) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const rows = await ClubPrendasUniforme.findAll({
    where: { club_id: clubId, activo: true },
    order: [['id', 'ASC']],
  });
  return { ok: true, data: rows.map(formatPrenda) };
}

export async function crearPrendaUniforme(clubId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const nombre = payload.nombre?.trim();
  const sistema = String(payload.sistema_talla || '').toUpperCase();
  if (!nombre) return { ok: false, status: 400, error: 'nombre requerido' };
  if (!SISTEMAS_TALLA.includes(sistema)) {
    return { ok: false, status: 400, error: 'sistema_talla inválido' };
  }

  const existing = await ClubPrendasUniforme.findOne({
    where: { club_id: clubId, nombre },
  });
  if (existing) return { ok: false, status: 409, error: 'Ya existe una prenda con ese nombre' };

  const row = await ClubPrendasUniforme.create({
    club_id: clubId,
    nombre,
    sistema_talla: sistema,
    activo: true,
  });
  return { ok: true, data: formatPrenda(row) };
}

export async function listarUniformesClub(clubId, userId, { divisionId } = {}) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const prendas = await ClubPrendasUniforme.findAll({
    where: { club_id: clubId, activo: true },
    order: [['id', 'ASC']],
  });
  const prendasFmt = prendas.map(formatPrenda);
  const totalPrendas = prendasFmt.length;

  const divisionWhere = { club_id: clubId };
  if (divisionId) divisionWhere.id = parseId(divisionId);

  const divisiones = await ClubDivisiones.findAll({
    where: divisionWhere,
    include: [{
      association: 'atletas',
      include: [{ model: User, as: 'usuario', attributes: userAttrs }],
    }],
    order: [['id', 'ASC']],
  });

  const divisionIds = divisiones.map((d) => d.id);
  const asignacionesRows = divisionIds.length ? await ClubUniformeAsignaciones.findAll({
    where: { club_division_id: { [Op.in]: divisionIds } },
    include: [
      { model: ClubPrendasUniforme, as: 'prenda' },
      { model: User, as: 'usuario', attributes: userAttrs },
    ],
  }) : [];

  const asignacionesMap = new Map();
  for (const row of asignacionesRows) {
    asignacionesMap.set(`${row.club_division_id}:${row.usuario_id}:${row.prenda_id}`, formatAsignacion(row));
  }

  const divisionesFmt = divisiones.map((div) => {
    const jugadores = (div.atletas ?? []).map((atleta) => {
      const asignaciones = prendasFmt.map((prenda) => {
        const key = `${div.id}:${atleta.usuario_id}:${prenda.id}`;
        if (asignacionesMap.has(key)) {
          return {
            ...asignacionesMap.get(key),
            sin_asignar: false,
          };
        }
        return {
          id: null,
          usuario_id: atleta.usuario_id,
          club_division_id: div.id,
          prenda_id: prenda.id,
          prenda,
          talla: null,
          cantidad: 1,
          estado_actual: null,
          fecha_entrega: null,
          entregado: false,
          tiene_alerta: false,
          sin_asignar: true,
        };
      });

      return {
        usuario_id: atleta.usuario_id,
        usuario: atleta.usuario,
        progreso: calcularProgresoJugador(asignaciones, totalPrendas),
        asignaciones,
      };
    });

    return {
      id: div.id,
      nombre: div.nombre,
      jugadores,
    };
  });

  return {
    ok: true,
    data: {
      prendas: prendasFmt,
      divisiones: divisionesFmt,
    },
  };
}

async function cargarAsignacionCompleta(id) {
  return ClubUniformeAsignaciones.findByPk(id, {
    include: [
      { model: User, as: 'usuario', attributes: userAttrs },
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'club_id'] },
      { model: ClubPrendasUniforme, as: 'prenda' },
    ],
  });
}

export async function asignarUniforme(clubId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const divisionId = parseId(payload.club_division_id);
  const usuarioId = parseId(payload.usuario_id);
  const prendaId = parseId(payload.prenda_id);
  const talla = payload.talla?.trim();
  if (!divisionId || !usuarioId || !prendaId || !talla) {
    return { ok: false, status: 400, error: 'club_division_id, usuario_id, prenda_id y talla requeridos' };
  }

  const division = await ClubDivisiones.findOne({ where: { id: divisionId, club_id: clubId } });
  if (!division) return { ok: false, status: 404, error: 'División no encontrada' };

  const prenda = await ClubPrendasUniforme.findOne({
    where: { id: prendaId, club_id: clubId, activo: true },
  });
  if (!prenda) return { ok: false, status: 404, error: 'Prenda no encontrada' };
  if (!tallaValidaParaSistema(prenda.sistema_talla, talla)) {
    return { ok: false, status: 400, error: 'Talla inválida para el sistema de la prenda' };
  }

  const cantidad = parseInt(payload.cantidad ?? 1, 10);
  const estadoInicial = payload.estado_actual
    ? String(payload.estado_actual).toUpperCase()
    : 'NUEVO';
  if (!estadoUniformeValido(estadoInicial)) {
    return { ok: false, status: 400, error: 'estado_actual inválido' };
  }

  const existing = await ClubUniformeAsignaciones.findOne({
    where: { usuario_id: usuarioId, club_division_id: divisionId, prenda_id: prendaId },
  });

  let row;
  if (existing) {
    row = await existing.update({
      talla,
      cantidad: Number.isNaN(cantidad) ? 1 : Math.max(1, cantidad),
      fecha_entrega: payload.fecha_entrega ?? existing.fecha_entrega,
    });
  } else {
    row = await ClubUniformeAsignaciones.create({
      usuario_id: usuarioId,
      club_division_id: divisionId,
      prenda_id: prendaId,
      talla,
      cantidad: Number.isNaN(cantidad) ? 1 : Math.max(1, cantidad),
      estado_actual: estadoInicial,
      fecha_entrega: payload.fecha_entrega ?? null,
    });
  }

  const full = await cargarAsignacionCompleta(row.id);
  return { ok: true, data: formatAsignacion(full ?? row) };
}

export async function actualizarUniforme(clubId, asignacionId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const id = parseId(asignacionId);
  const row = await ClubUniformeAsignaciones.findByPk(id, {
    include: [
      { model: ClubDivisiones, as: 'division' },
      { model: ClubPrendasUniforme, as: 'prenda' },
    ],
  });
  if (!row?.division || row.division.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Asignación no encontrada' };
  }

  if (payload.talla?.trim()) {
    const talla = payload.talla.trim();
    if (!tallaValidaParaSistema(row.prenda?.sistema_talla, talla)) {
      return { ok: false, status: 400, error: 'Talla inválida para el sistema de la prenda' };
    }
    row.talla = talla;
  }

  if (payload.cantidad != null) {
    const cantidad = parseInt(payload.cantidad, 10);
    row.cantidad = Number.isNaN(cantidad) ? row.cantidad : Math.max(1, cantidad);
  }

  if (payload.fecha_entrega !== undefined) {
    row.fecha_entrega = payload.fecha_entrega || null;
  }

  const nuevoEstado = payload.estado_actual ? String(payload.estado_actual).toUpperCase() : null;
  if (nuevoEstado) {
    if (!estadoUniformeValido(nuevoEstado)) {
      return { ok: false, status: 400, error: 'estado_actual inválido' };
    }
    if (nuevoEstado !== row.estado_actual) {
      await ClubUniformeHistorial.create({
        asignacion_id: row.id,
        estado_anterior: row.estado_actual,
        estado_nuevo: nuevoEstado,
        fecha_cambio: new Date(),
        registrado_por_id: userId,
        notas: payload.notas?.trim() || null,
      });
      row.estado_actual = nuevoEstado;
    }
  }

  await row.save();

  const full = await cargarAsignacionCompleta(row.id);
  return { ok: true, data: formatAsignacion(full) };
}

export async function obtenerHistorialUniforme(clubId, asignacionId, userId) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const id = parseId(asignacionId);
  const asignacion = await ClubUniformeAsignaciones.findByPk(id, {
    include: [
      { model: ClubDivisiones, as: 'division' },
      { model: ClubPrendasUniforme, as: 'prenda' },
      { model: User, as: 'usuario', attributes: userAttrs },
    ],
  });
  if (!asignacion?.division || asignacion.division.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Asignación no encontrada' };
  }

  const historial = await ClubUniformeHistorial.findAll({
    where: { asignacion_id: id },
    include: [{ model: User, as: 'registradoPor', attributes: userAttrs }],
    order: [['fecha_cambio', 'DESC'], ['id', 'DESC']],
  });

  return {
    ok: true,
    data: {
      asignacion: formatAsignacion(asignacion),
      historial: historial.map(formatHistorial),
    },
  };
}

export async function obtenerMiUniformeClub(clubId, userId) {
  const auth = await assertMiembro(clubId, userId);
  if (!auth.ok) return auth;

  const rows = await ClubUniformeAsignaciones.findAll({
    where: { usuario_id: userId },
    include: [
      {
        model: ClubDivisiones,
        as: 'division',
        where: { club_id: clubId },
        required: true,
        attributes: ['id', 'nombre'],
      },
      { model: ClubPrendasUniforme, as: 'prenda' },
    ],
    order: [['id', 'ASC']],
  });
  return { ok: true, data: rows.map(formatAsignacion) };
}

/**
 * Genera ClubPagoMiembro para conceptos MENSUALIDAD con ciclo individual.
 * Primera fecha de corte = fecha_ingreso + dias_gracia.
 * Siguiente = mismo día del mes anclado (ej. 31 → feb 28/29 → mar 31).
 */
export async function generarMensualidadesClub(hoyStr = new Date().toISOString().slice(0, 10)) {
  const conceptos = await ClubConceptosPago.findAll({
    where: { tipo: 'MENSUALIDAD', activo: true },
  });

  let generados = 0;

  for (const concepto of conceptos) {
    await limpiarMensualidadesSinInscripcion(concepto.club_id);

    const miembros = await obtenerMiembrosActivosClubParaPagos(concepto.club_id);

    for (const miembro of miembros) {
      generados += await generarMensualidadesMiembro(concepto, miembro, hoyStr, {
        soloSiguiente: true,
      });
    }
  }

  return generados;
}

/**
 * Genera un único ClubPagoMiembro por miembro para conceptos CUOTA_INGRESO.
 * Fecha de corte = fecha de ingreso al club. No se vuelve a generar.
 */
export async function generarCuotasIngresoClub(hoyStr = new Date().toISOString().slice(0, 10)) {
  const conceptos = await ClubConceptosPago.findAll({
    where: { tipo: 'CUOTA_INGRESO', activo: true },
  });

  let generados = 0;

  for (const concepto of conceptos) {
    const diasAviso = concepto.dias_aviso_previo ?? 5;
    const limiteGeneracion = addDaysToDateOnly(hoyStr, diasAviso);

    const miembros = await obtenerMiembrosActivosClubParaPagos(concepto.club_id);

    for (const miembro of miembros) {
      const fechaIngreso = toDateOnly(miembro.fecha_ingreso);
      if (!fechaIngreso) continue;

      const yaTiene = await ClubPagosMiembro.findOne({
        where: {
          concepto_pago_id: concepto.id,
          usuario_id: miembro.usuario_id,
        },
        attributes: ['id'],
      });
      if (yaTiene) continue;

      const fechaCorte = fechaIngreso;
      if (fechaCorte > limiteGeneracion) continue;

      await ClubPagosMiembro.create({
        concepto_pago_id: concepto.id,
        usuario_id: miembro.usuario_id,
        fecha_corte: fechaCorte,
        estado: 'PENDIENTE',
        registrado_por_id: null,
      });
      generados += 1;
    }
  }

  return generados;
}

/** Marca VENCIDO, genera mensualidades/cuotas de ingreso y envía avisos previos al corte. */
export async function ejecutarMantenimientoPagosClub() {
  const hoyStr = new Date().toISOString().slice(0, 10);

  await revertirVencidosPagosUnicos();

  const conceptosMensualidad = await ClubConceptosPago.findAll({
    where: { tipo: 'MENSUALIDAD', activo: true },
    attributes: ['id', 'club_id'],
  });

  for (const concepto of conceptosMensualidad) {
    await limpiarMensualidadesSinInscripcion(concepto.club_id);
  }

  const mensualidadIds = conceptosMensualidad.map((c) => c.id);
  const [vencidos] = mensualidadIds.length
    ? await ClubPagosMiembro.update(
      { estado: 'VENCIDO' },
      {
        where: {
          concepto_pago_id: { [Op.in]: mensualidadIds },
          estado: 'PENDIENTE',
          fecha_corte: { [Op.lt]: hoyStr },
        },
      },
    )
    : [0];

  const generadosMensualidades = await generarMensualidadesClub(hoyStr);
  const generadosCuotasIngreso = await generarCuotasIngresoClub(hoyStr);
  const generados = generadosMensualidades + generadosCuotasIngreso;

  const pendientes = await ClubPagosMiembro.findAll({
    where: {
      estado: 'PENDIENTE',
      aviso_enviado_at: null,
    },
    include: [{
      model: ClubConceptosPago,
      as: 'concepto',
      required: true,
      include: [{ model: Clubs, as: 'club', attributes: ['id', 'nombre'] }],
    }],
  });

  let avisos = 0;
  for (const pago of pendientes) {
    const dias = pago.concepto?.dias_aviso_previo ?? 5;
    const corte = new Date(`${pago.fecha_corte}T12:00:00`);
    const avisoDate = new Date(corte);
    avisoDate.setDate(avisoDate.getDate() - dias);
    const avisoStr = avisoDate.toISOString().slice(0, 10);
    if (avisoStr !== hoyStr) continue;

    await notificarPagoClubProximo({
      pago,
      club: pago.concepto.club,
      concepto: pago.concepto,
    });
    pago.aviso_enviado_at = new Date();
    await pago.save();
    avisos += 1;
  }

  return { vencidos, generados, avisos };
}

function formatMontoPago(monto) {
  const n = Number(monto);
  if (Number.isNaN(n) || n <= 0) return '—';
  return `$${n.toLocaleString('es-CO')}`;
}

function formatFechaCortePago(fecha) {
  const str = toDateOnly(fecha);
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

export function construirMensajeWhatsappPago({
  plantilla,
  clubNombre,
  pago,
  concepto,
}) {
  const base = (plantilla?.trim() || WHATSAPP_PAGO_PLANTILLA_DEFAULT);
  const nombre = pago?.usuario?.name || pago?.usuario?.nick || 'miembro';
  const conceptoNombre = concepto?.nombre_display
    || concepto?.nombre_personalizado?.trim()
    || concepto?.tipo?.replace(/_/g, ' ').toLowerCase()
    || 'pago';

  return base
    .replaceAll('{nombre}', nombre)
    .replaceAll('{club}', clubNombre || 'el club')
    .replaceAll('{concepto}', conceptoNombre)
    .replaceAll('{monto}', formatMontoPago(concepto?.monto))
    .replaceAll('{fecha_corte}', formatFechaCortePago(pago?.fecha_corte));
}

export async function obtenerPlantillaWhatsappPago(clubId, userId) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const club = await Clubs.findByPk(clubId, {
    attributes: ['id', 'nombre', 'whatsapp_plantilla_pago'],
  });
  if (!club) return { ok: false, status: 404, error: 'Club no encontrado' };

  return {
    ok: true,
    data: {
      plantilla: club.whatsapp_plantilla_pago?.trim() || null,
      plantilla_default: WHATSAPP_PAGO_PLANTILLA_DEFAULT,
      placeholders: WHATSAPP_PAGO_PLACEHOLDERS,
      club_nombre: club.nombre,
    },
  };
}

export async function actualizarPlantillaWhatsappPago(clubId, userId, payload) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const club = await Clubs.findByPk(clubId);
  if (!club) return { ok: false, status: 404, error: 'Club no encontrado' };

  const raw = payload?.plantilla;
  if (raw == null) {
    return { ok: false, status: 400, error: 'plantilla requerida' };
  }

  const trimmed = String(raw).trim();
  club.whatsapp_plantilla_pago = trimmed.length ? trimmed : null;
  await club.save();

  return {
    ok: true,
    data: {
      plantilla: club.whatsapp_plantilla_pago,
      plantilla_default: WHATSAPP_PAGO_PLANTILLA_DEFAULT,
      placeholders: WHATSAPP_PAGO_PLACEHOLDERS,
    },
  };
}

export async function enviarRecordatorioPagoManual(clubId, userId, pagoId) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const id = parseId(pagoId);
  const pago = await ClubPagosMiembro.findByPk(id, {
    include: [
      {
        model: ClubConceptosPago,
        as: 'concepto',
        where: { club_id: clubId },
        required: true,
      },
      { model: User, as: 'usuario', attributes: userAttrs },
    ],
  });
  if (!pago) return { ok: false, status: 404, error: 'Pago no encontrado' };

  if (pago.estado === 'PAGADO' || pago.estado === 'CORTESIA') {
    return { ok: false, status: 400, error: 'Este pago ya está saldado' };
  }

  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'nombre'] });
  if (!club) return { ok: false, status: 404, error: 'Club no encontrado' };

  await notificarPagoClubRecordatorioManual({
    pago,
    club,
    concepto: pago.concepto,
  });

  return { ok: true, data: { enviado: true } };
}

export async function obtenerMensajeWhatsappPago(clubId, userId, pagoId) {
  const auth = await assertPuedeGestionar(clubId, userId);
  if (!auth.ok) return auth;

  const id = parseId(pagoId);
  const pago = await ClubPagosMiembro.findByPk(id, {
    include: [
      {
        model: ClubConceptosPago,
        as: 'concepto',
        where: { club_id: clubId },
        required: true,
      },
      { model: User, as: 'usuario', attributes: userAttrs },
    ],
  });
  if (!pago) return { ok: false, status: 404, error: 'Pago no encontrado' };

  const club = await Clubs.findByPk(clubId, {
    attributes: ['id', 'nombre', 'whatsapp_plantilla_pago'],
  });
  if (!club) return { ok: false, status: 404, error: 'Club no encontrado' };

  const mensaje = construirMensajeWhatsappPago({
    plantilla: club.whatsapp_plantilla_pago,
    clubNombre: club.nombre,
    pago,
    concepto: pago.concepto,
  });

  return {
    ok: true,
    data: {
      mensaje,
      telefono: pago.usuario?.telefono ?? null,
      usuario_id: pago.usuario_id,
    },
  };
}
