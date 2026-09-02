import { Op } from 'sequelize';
import {
  Reservas,
  Canchas,
  Complejos,
  CanchaHorariosPrecios,
  CalendarioExcepciones,
  ComplejoHorarios,
  User
} from '../db/db.js';

// ============================================================
// HELPERS PRIVADOS
// ============================================================

/**
 * Normaliza una hora al formato HH:MM:SS
 * Acepta: "HH:MM" o "HH:MM:SS"
 * Retorna: "HH:MM:SS"
 */
const normalizarHora = (hora) => {
  if (!hora) return null;
  const partes = hora.split(':');
  if (partes.length === 2) {
    return `${hora}:00`;
  }
  return hora;
};

/**
 * Calcula la hora de fin dada una hora de inicio y duración en minutos.
 * Retorna un string "HH:MM:SS".
 */
const calcularHoraFin = (horaInicio, duracionMinutos) => {
  const horaNormalizada = normalizarHora(horaInicio);
  const [h, m] = horaNormalizada.split(':').map(Number);
  const totalMinutos = h * 60 + m + duracionMinutos;
  const hFin = Math.floor(totalMinutos / 60) % 24;
  const mFin = totalMinutos % 60;
  return `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}:00`;
};

/**
 * Motor de cálculo de precio.
 * Prioridad: precio dinámico (festivo > día semana) > precio base de la cancha.
 */
const calcularPrecio = async (cancha, fecha, horaInicio, duracionMinutos) => {
  const fechaObj = new Date(fecha + 'T00:00:00');
  const diaSemana = fechaObj.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab

  // Verificar si la fecha es festivo para el complejo de esa cancha
  const excepcion = await CalendarioExcepciones.findOne({
    where: {
      complejo_id: cancha.complejo_id,
      fecha: fecha
    }
  });

  const esFestivo = excepcion?.es_festivo === true;
  const estaAbierto = excepcion ? excepcion.esta_abierto : true;

  if (!estaAbierto) {
    return { error: 'El complejo está cerrado en esa fecha', estaAbierto: false };
  }

  // tipo_dia: 7 si es festivo, sino día de la semana
  const tipoDia = esFestivo ? 7 : diaSemana;

  // Buscar precio dinámico que cubra la hora de inicio
  const precioDinamico = await CanchaHorariosPrecios.findOne({
    where: {
      cancha_id: cancha.id,
      tipo_dia: tipoDia,
      hora_inicio: { [Op.lte]: horaInicio },
      hora_fin: { [Op.gt]: horaInicio }
    }
  });

  // Si no hay precio dinámico para ese tipo_dia, intentar con festivo si aplica
  let precioHora;
  if (precioDinamico) {
    precioHora = parseFloat(precioDinamico.precio_hora);
  } else if (esFestivo) {
    // Intentar precio del día de la semana como fallback
    const precioDiaSemana = await CanchaHorariosPrecios.findOne({
      where: {
        cancha_id: cancha.id,
        tipo_dia: diaSemana,
        hora_inicio: { [Op.lte]: horaInicio },
        hora_fin: { [Op.gt]: horaInicio }
      }
    });
    precioHora = precioDiaSemana
      ? parseFloat(precioDiaSemana.precio_hora)
      : parseFloat(cancha.precio_hora || 0);
  } else {
    precioHora = parseFloat(cancha.precio_hora || 0);
  }

  const montoTotal = precioHora * (duracionMinutos / 60);
  const montoAbono = parseFloat((montoTotal * 0.3).toFixed(2));

  return {
    precioHora,
    montoTotal: parseFloat(montoTotal.toFixed(2)),
    montoAbono,
    esFestivo,
    estaAbierto: true
  };
};

/**
 * Verifica disponibilidad: ninguna reserva activa en esa cancha, fecha y rango horario.
 * Usa desigualdad estricta para permitir reservas consecutivas.
 */
const verificarDisponibilidad = async (canchaId, fecha, horaInicio, duracionMinutos, excluirReservaId = null) => {
  const horaFin = calcularHoraFin(horaInicio, duracionMinutos);

  const where = {
    cancha_id: canchaId,
    fecha: fecha,
    estado_reserva: { [Op.notIn]: ['CANCELADA'] },
    hora_inicio: { [Op.lt]: horaFin },
    [Op.and]: sequelize.literal(
      `ADDTIME(hora_inicio, SEC_TO_TIME(duracion_minutos * 60)) > '${horaInicio}'`
    )
  };

  if (excluirReservaId) {
    where.id = { [Op.ne]: excluirReservaId };
  }

  const conflicto = await Reservas.findOne({ where });
  return { disponible: !conflicto, conflicto };
};

/**
 * Verifica si el usuario autenticado es dueño del complejo al que pertenece la cancha.
 */
const esDuenoDeCancha = async (userId, canchaId) => {
  const cancha = await Canchas.findByPk(canchaId, {
    include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'dueño_id'] }]
  });
  if (!cancha) return { esDueno: false, cancha: null };
  return {
    esDueno: cancha.complejo.dueño_id === userId,
    cancha
  };
};

// Importar sequelize para usar literal()
import { sequelize } from '../db/db.js';

// ============================================================
// CONTROLADORES
// ============================================================

/**
 * POST /api/reservas
 * Crear una reserva. Cualquier usuario autenticado puede reservar.
 *
 * Body:
 * {
 *   "cancha_id": 1,
 *   "fecha": "2026-05-20",
 *   "hora_inicio": "10:00",
 *   "duracion_minutos": 60,
 *   "metodo_pago": "NEQUI"
 * }
 */
export const crearReserva = async (req, res) => {
  try {
    const adminUserId = req.user?.id; // ID del admin que está creando la reserva
    const { 
      cancha_id, 
      fecha, 
      hora_inicio, 
      duracion_minutos = 60, 
      metodo_pago,
      origen_reserva = 'WEB',
      telefono_contacto,
      nombre_contacto,
      estado_pago
    } = req.body;

    // Validaciones básicas
    if (!cancha_id || !fecha || !hora_inicio) {
      return res.status(400).json({
        success: false,
        message: 'cancha_id, fecha y hora_inicio son obligatorios'
      });
    }

    // Variable para el user_id final que se usará en la reserva
    let finalUserId = null;

    if (![60, 90, 120].includes(Number(duracion_minutos))) {
      return res.status(400).json({
        success: false,
        message: 'duracion_minutos debe ser 60, 90 o 120'
      });
    }

    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'fecha debe tener formato YYYY-MM-DD'
      });
    }

    const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!horaRegex.test(hora_inicio)) {
      return res.status(400).json({
        success: false,
        message: 'hora_inicio debe tener formato HH:MM'
      });
    }

    // Verificar que la cancha existe
    const cancha = await Canchas.findByPk(cancha_id, {
      include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'dueño_id', 'nombre'] }]
    });

    if (!cancha) {
      return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
    }

    // Calcular precio según día/hora/festivo
    const precioInfo = await calcularPrecio(cancha, fecha, hora_inicio, Number(duracion_minutos));

    if (precioInfo.error) {
      return res.status(400).json({ success: false, message: precioInfo.error });
    }

    // Verificar disponibilidad (sin solapamiento)
    const horaInicioNormalizada = normalizarHora(hora_inicio);
    const horaFin = calcularHoraFin(hora_inicio, Number(duracion_minutos));
    
    const reservasConflicto = await Reservas.findAll({
      where: {
        cancha_id,
        fecha,
        estado_reserva: { [Op.notIn]: ['CANCELADA'] }
      }
    });

    const hayConflicto = reservasConflicto.some(r => {
      const rHoraInicio = normalizarHora(r.hora_inicio);
      const rHoraFin = calcularHoraFin(r.hora_inicio, r.duracion_minutos);
      
      // Dos reservas se solapan SI:
      // inicio_A < fin_B AND fin_A > inicio_B
      // Reservas consecutivas (una termina cuando otra empieza) NO se solapan
      return rHoraInicio < horaFin && rHoraFin > horaInicioNormalizada;
    });

    if (hayConflicto) {
      return res.status(409).json({
        success: false,
        message: 'Esta cancha ya está reservada para ese horario'
      });
    }

    // Si es reserva MANUAL, buscar o crear el usuario del cliente
    if (origen_reserva === 'MANUAL') {
      if (!telefono_contacto || !nombre_contacto) {
        return res.status(400).json({
          success: false,
          message: 'Para reservas manuales, telefono_contacto y nombre_contacto son obligatorios'
        });
      }

      // Normalizar teléfono
      const telefonoNormalizado = telefono_contacto.replace(/\D/g, '');

      // Buscar usuario existente por teléfono
      let usuarioCliente = await User.findOne({
        where: {
          [Op.or]: [
            { telefono: telefonoNormalizado },
            { telefono: telefono_contacto }
          ]
        }
      });

      // Si NO existe, crear el usuario automáticamente
      if (!usuarioCliente) {
        console.log(`📝 Creando nuevo usuario: ${nombre_contacto} (${telefono_contacto})`);
        
        usuarioCliente = await User.create({
          name: nombre_contacto,
          telefono: telefonoNormalizado,
          role: 'JUGADOR',
          status: 'ACTIVO',
          creado_at: new Date()
        });

        console.log(`✅ Usuario creado con ID: ${usuarioCliente.id}`);
      } else {
        console.log(`👤 Usuario encontrado: ${usuarioCliente.name} (ID: ${usuarioCliente.id})`);
      }

      // Usar el user_id del cliente (encontrado o creado)
      finalUserId = usuarioCliente.id;
    } else {
      // Para reservas WEB/APP, usar el userId del usuario autenticado
      finalUserId = adminUserId;
    }

    // Calcular monto de abono según estado de pago
    let montoAbono = precioInfo.montoAbono;
    let estadoPagoFinal = estado_pago || 'ABONADA';
    
    if (estadoPagoFinal === 'PAGADA_TOTAL') {
      montoAbono = precioInfo.montoTotal;
    } else if (estadoPagoFinal === 'pendiente') {
      montoAbono = 0;
      estadoPagoFinal = 'ABONADA';
    }

    // Crear la reserva
    const datosReserva = {
      user_id: finalUserId, // Usar el user_id correcto (cliente o admin)
      cancha_id,
      fecha,
      hora_inicio: hora_inicio + ':00',
      duracion_minutos: Number(duracion_minutos),
      monto_total: precioInfo.montoTotal,
      monto_abono: montoAbono,
      metodo_pago: metodo_pago || null,
      estado_pago: estadoPagoFinal,
      estado_reserva: 'CONFIRMADA',
      origen_reserva: origen_reserva,
      telefono_contacto: telefono_contacto || null,
      nombre_contacto: nombre_contacto || null,
      creado_at: new Date()
    };

    const nuevaReserva = await Reservas.create(datosReserva);

    return res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente',
      data: {
        id: nuevaReserva.id,
        cancha: cancha.nombre,
        complejo: cancha.complejo.nombre,
        fecha,
        hora_inicio: hora_inicio,
        hora_fin: horaFin,
        duracion_minutos: Number(duracion_minutos),
        es_festivo: precioInfo.esFestivo,
        precio_hora: precioInfo.precioHora,
        monto_total: precioInfo.montoTotal,
        monto_abono: precioInfo.montoAbono,
        saldo_pendiente: parseFloat((precioInfo.montoTotal - precioInfo.montoAbono).toFixed(2)),
        metodo_pago: metodo_pago || null,
        estado_pago: 'ABONADA',
        estado_reserva: 'CONFIRMADA'
      }
    });

  } catch (error) {
    console.error('Error en crearReserva:', error);
    return res.status(500).json({ success: false, message: 'Error al crear la reserva', error: error.message });
  }
};

/**
 * GET /api/reservas/mis-reservas
 * Lista las reservas del usuario autenticado.
 */
export const getMisReservas = async (req, res) => {
  try {
    const userId = req.user.id;
    const { estado, fecha_desde, fecha_hasta } = req.query;

    const where = { user_id: userId };
    if (estado) where.estado_reserva = estado;
    if (fecha_desde || fecha_hasta) {
      where.fecha = {};
      if (fecha_desde) where.fecha[Op.gte] = fecha_desde;
      if (fecha_hasta) where.fecha[Op.lte] = fecha_hasta;
    }

    const reservas = await Reservas.findAll({
      where,
      include: [{
        model: Canchas,
        as: 'cancha',
        attributes: ['id', 'nombre', 'tipo_deporte'],
        include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'nombre'] }]
      }],
      order: [['fecha', 'DESC'], ['hora_inicio', 'ASC']]
    });

    const data = reservas.map(r => ({
      id: r.id,
      cancha: r.cancha?.nombre,
      complejo: r.cancha?.complejo?.nombre,
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      hora_fin: calcularHoraFin(r.hora_inicio, r.duracion_minutos),
      duracion_minutos: r.duracion_minutos,
      monto_total: parseFloat(r.monto_total),
      monto_abono: parseFloat(r.monto_abono),
      saldo_pendiente: parseFloat((r.monto_total - r.monto_abono).toFixed(2)),
      metodo_pago: r.metodo_pago,
      estado_pago: r.estado_pago,
      estado_reserva: r.estado_reserva,
      fue_movida: !!r.fecha_original,
      fecha_original: r.fecha_original || null,
      hora_inicio_original: r.hora_inicio_original || null,
      motivo_movimiento: r.motivo_movimiento || null,
      creado_at: r.creado_at
    }));

    return res.status(200).json({ success: true, total: data.length, data });

  } catch (error) {
    console.error('Error en getMisReservas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener reservas', error: error.message });
  }
};

/**
 * GET /api/reservas/cancha/:canchaId
 * Lista todas las reservas de una cancha. Solo el dueño del complejo.
 */
export const getReservasPorCancha = async (req, res) => {
  try {
    const userId = req.user.id;
    const canchaId = parseInt(req.params.canchaId);
    const { estado, fecha_desde, fecha_hasta } = req.query;

    const { esDueno, cancha } = await esDuenoDeCancha(userId, canchaId);
    if (!cancha) {
      return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
    }
    if (!esDueno) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver estas reservas' });
    }

    const where = { cancha_id: canchaId };
    if (estado) where.estado_reserva = estado;
    if (fecha_desde || fecha_hasta) {
      where.fecha = {};
      if (fecha_desde) where.fecha[Op.gte] = fecha_desde;
      if (fecha_hasta) where.fecha[Op.lte] = fecha_hasta;
    }

    const reservas = await Reservas.findAll({
      where,
      include: [{ model: User, as: 'usuario', attributes: ['id', 'name', 'email'] }],
      order: [['fecha', 'ASC'], ['hora_inicio', 'ASC']]
    });

    const data = reservas.map(r => ({
      id: r.id,
      usuario: r.usuario ? { id: r.usuario.id, nombre: r.usuario.name, email: r.usuario.email } : null,
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      hora_fin: calcularHoraFin(r.hora_inicio, r.duracion_minutos),
      duracion_minutos: r.duracion_minutos,
      monto_total: parseFloat(r.monto_total),
      monto_abono: parseFloat(r.monto_abono),
      saldo_pendiente: parseFloat((r.monto_total - r.monto_abono).toFixed(2)),
      metodo_pago: r.metodo_pago,
      estado_pago: r.estado_pago,
      estado_reserva: r.estado_reserva,
      fue_movida: !!r.fecha_original,
      fecha_original: r.fecha_original || null,
      hora_inicio_original: r.hora_inicio_original || null,
      motivo_movimiento: r.motivo_movimiento || null,
      creado_at: r.creado_at
    }));

    return res.status(200).json({
      success: true,
      cancha: cancha.nombre,
      total: data.length,
      data
    });

  } catch (error) {
    console.error('Error en getReservasPorCancha:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener reservas', error: error.message });
  }
};

/**
 * GET /api/reservas/complejo/:complejoId
 * Lista todas las reservas de todas las canchas de un complejo. Solo el dueño.
 */
export const getReservasPorComplejo = async (req, res) => {
  try {
    const userId = req.user.id;
    const complejoId = parseInt(req.params.complejoId);
    const { estado, fecha_desde, fecha_hasta } = req.query;

    const complejo = await Complejos.findByPk(complejoId, {
      include: [{ model: Canchas, as: 'canchas', attributes: ['id', 'nombre'] }]
    });

    if (!complejo) {
      return res.status(404).json({ success: false, message: 'Complejo no encontrado' });
    }
    if (complejo.dueño_id !== userId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver estas reservas' });
    }

    const canchaIds = complejo.canchas.map(c => c.id);

    const where = { cancha_id: { [Op.in]: canchaIds } };
    if (estado) where.estado_reserva = estado;
    if (fecha_desde || fecha_hasta) {
      where.fecha = {};
      if (fecha_desde) where.fecha[Op.gte] = fecha_desde;
      if (fecha_hasta) where.fecha[Op.lte] = fecha_hasta;
    }

    const reservas = await Reservas.findAll({
      where,
      include: [
        { model: User, as: 'usuario', attributes: ['id', 'name', 'email'] },
        { model: Canchas, as: 'cancha', attributes: ['id', 'nombre', 'tipo_deporte'] }
      ],
      order: [['fecha', 'ASC'], ['hora_inicio', 'ASC']]
    });

    const data = reservas.map(r => ({
      id: r.id,
      cancha: r.cancha ? { id: r.cancha.id, nombre: r.cancha.nombre, tipo_deporte: r.cancha.tipo_deporte } : null,
      usuario: r.usuario ? { id: r.usuario.id, nombre: r.usuario.name, email: r.usuario.email } : null,
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      hora_fin: calcularHoraFin(r.hora_inicio, r.duracion_minutos),
      duracion_minutos: r.duracion_minutos,
      monto_total: parseFloat(r.monto_total),
      monto_abono: parseFloat(r.monto_abono),
      saldo_pendiente: parseFloat((r.monto_total - r.monto_abono).toFixed(2)),
      metodo_pago: r.metodo_pago,
      estado_pago: r.estado_pago,
      estado_reserva: r.estado_reserva,
      fue_movida: !!r.fecha_original,
      motivo_movimiento: r.motivo_movimiento || null,
      creado_at: r.creado_at
    }));

    return res.status(200).json({
      success: true,
      complejo: complejo.nombre,
      total: data.length,
      data
    });

  } catch (error) {
    console.error('Error en getReservasPorComplejo:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener reservas', error: error.message });
  }
};

/**
 * GET /api/reservas/:id
 * Ver detalle de una reserva. El propio usuario o el dueño del complejo.
 */
export const getReservaById = async (req, res) => {
  try {
    const userId = req.user.id;
    const reservaId = parseInt(req.params.id);

    const reserva = await Reservas.findByPk(reservaId, {
      include: [
        { model: User, as: 'usuario', attributes: ['id', 'name', 'email'] },
        {
          model: Canchas,
          as: 'cancha',
          attributes: ['id', 'nombre', 'tipo_deporte'],
          include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'nombre', 'dueño_id'] }]
        }
      ]
    });

    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    const esPropietario = reserva.user_id === userId;
    const esDueno = reserva.cancha?.complejo?.dueño_id === userId;

    if (!esPropietario && !esDueno) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver esta reserva' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: reserva.id,
        usuario: reserva.usuario ? { id: reserva.usuario.id, nombre: reserva.usuario.name, email: reserva.usuario.email } : null,
        cancha: reserva.cancha?.nombre,
        complejo: reserva.cancha?.complejo?.nombre,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        hora_fin: calcularHoraFin(reserva.hora_inicio, reserva.duracion_minutos),
        duracion_minutos: reserva.duracion_minutos,
        monto_total: parseFloat(reserva.monto_total),
        monto_abono: parseFloat(reserva.monto_abono),
        saldo_pendiente: parseFloat((reserva.monto_total - reserva.monto_abono).toFixed(2)),
        metodo_pago: reserva.metodo_pago,
        estado_pago: reserva.estado_pago,
        estado_reserva: reserva.estado_reserva,
        fue_movida: !!reserva.fecha_original,
        fecha_original: reserva.fecha_original || null,
        hora_inicio_original: reserva.hora_inicio_original || null,
        motivo_movimiento: reserva.motivo_movimiento || null,
        movida_at: reserva.movida_at || null,
        cancelada_at: reserva.cancelada_at || null,
        creado_at: reserva.creado_at
      }
    });

  } catch (error) {
    console.error('Error en getReservaById:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener la reserva', error: error.message });
  }
};

/**
 * PATCH /api/reservas/:id/mover
 * Mover una reserva a otra fecha/hora/cancha. Solo el dueño del complejo.
 *
 * Body:
 * {
 *   "nueva_fecha": "2026-05-22",  // opcional, si no se envía mantiene la misma
 *   "nueva_hora_inicio": "14:00", // opcional, si no se envía mantiene la misma
 *   "nueva_cancha_id": 3,         // opcional, si no se envía mantiene la misma
 *   "motivo": "Mantenimiento"     // opcional
 * }
 */
export const moverReserva = async (req, res) => {
  try {
    const userId = req.user.id;
    const reservaId = parseInt(req.params.id);
    const { nueva_fecha, nueva_hora_inicio, nueva_cancha_id, motivo } = req.body;

    // Log para depuración
    console.log('🔄 [moverReserva] Datos recibidos:', {
      reservaId_raw: req.params.id,
      reservaId_parsed: reservaId,
      nueva_cancha_id_raw: nueva_cancha_id,
      nueva_cancha_id_type: typeof nueva_cancha_id,
      nueva_fecha,
      nueva_hora_inicio,
      motivo
    });

    // Validar que reservaId es un número válido
    if (!reservaId || isNaN(reservaId)) {
      console.error('❌ [moverReserva] ID de reserva inválido:', req.params.id);
      return res.status(400).json({
        success: false,
        message: 'ID de reserva inválido'
      });
    }

    // Validar nueva_cancha_id si está presente
    if (nueva_cancha_id !== undefined && nueva_cancha_id !== null) {
      const canchaIdParsed = parseInt(nueva_cancha_id);
      if (isNaN(canchaIdParsed)) {
        return res.status(400).json({
          success: false,
          message: 'ID de cancha inválido'
        });
      }
    }

    // Al menos uno debe cambiar
    if (!nueva_fecha && !nueva_hora_inicio && !nueva_cancha_id) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar al menos nueva_fecha, nueva_hora_inicio o nueva_cancha_id'
      });
    }

    const reserva = await Reservas.findByPk(reservaId, {
      include: [{
        model: Canchas,
        as: 'cancha',
        include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'dueño_id', 'nombre'] }]
      }]
    });

    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    if (reserva.cancha?.complejo?.dueño_id !== userId) {
      return res.status(403).json({ success: false, message: 'Solo el dueño del complejo puede mover reservas' });
    }

    if (reserva.estado_reserva === 'CANCELADA') {
      return res.status(400).json({ success: false, message: 'No se puede mover una reserva cancelada' });
    }

    if (reserva.estado_reserva === 'FINALIZADA') {
      return res.status(400).json({ success: false, message: 'No se puede mover una reserva finalizada' });
    }

    // Determinar valores finales (usar nuevos si se proveen, sino mantener actuales)
    // Convertir nueva_cancha_id a entero si existe
    const nuevaCanchaIdParsed = nueva_cancha_id ? parseInt(nueva_cancha_id) : null;
    const canchaIdFinal = nuevaCanchaIdParsed || reserva.cancha_id;
    const fechaFinal = nueva_fecha || reserva.fecha;
    const horaInicioFinal = nueva_hora_inicio || reserva.hora_inicio.substring(0, 5);

    console.log('📋 [moverReserva] Valores finales:', {
      nuevaCanchaIdParsed,
      canchaIdFinal,
      fechaFinal,
      horaInicioFinal,
      cambiaDeCancha: nuevaCanchaIdParsed && nuevaCanchaIdParsed !== reserva.cancha_id
    });

    // Si cambia de cancha, obtener la nueva cancha
    let nuevaCancha = reserva.cancha;
    if (nuevaCanchaIdParsed && nuevaCanchaIdParsed !== reserva.cancha_id) {
      nuevaCancha = await Canchas.findByPk(nuevaCanchaIdParsed, {
        include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'dueño_id'] }]
      });

      if (!nuevaCancha) {
        return res.status(404).json({ success: false, message: 'Nueva cancha no encontrada' });
      }

      // Verificar que la nueva cancha sea del mismo complejo
      if (nuevaCancha.complejo_id !== reserva.cancha.complejo_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se puede mover a una cancha de otro complejo' 
        });
      }
    }

    // Verificar disponibilidad en el nuevo horario/cancha
    const nuevaHoraNormalizada = normalizarHora(horaInicioFinal);
    const horaFin = calcularHoraFin(horaInicioFinal, reserva.duracion_minutos);
    
    const reservasConflicto = await Reservas.findAll({
      where: {
        cancha_id: canchaIdFinal,
        fecha: fechaFinal,
        id: { [Op.ne]: reservaId },
        estado_reserva: { [Op.notIn]: ['CANCELADA'] }
      }
    });

    const hayConflicto = reservasConflicto.some(r => {
      const rHoraInicio = normalizarHora(r.hora_inicio);
      const rHoraFin = calcularHoraFin(r.hora_inicio, r.duracion_minutos);
      return rHoraInicio < horaFin && rHoraFin > nuevaHoraNormalizada;
    });

    if (hayConflicto) {
      return res.status(409).json({
        success: false,
        message: 'El nuevo horario ya está ocupado por otra reserva'
      });
    }

    // Recalcular precio si cambió de cancha o fecha/hora
    let nuevoMontoTotal = parseFloat(reserva.monto_total);
    const montoAbonoActual = parseFloat(reserva.monto_abono);

    if (nuevaCanchaIdParsed || nueva_fecha || nueva_hora_inicio) {
      const precioInfo = await calcularPrecio(
        nuevaCancha, 
        fechaFinal, 
        horaInicioFinal, 
        reserva.duracion_minutos
      );

      if (precioInfo.error) {
        return res.status(400).json({ success: false, message: precioInfo.error });
      }

      nuevoMontoTotal = precioInfo.montoTotal;
    }

    // Guardar datos originales (solo si es la primera vez que se mueve)
    const fechaOriginal = reserva.fecha_original || reserva.fecha;
    const horaOriginal = reserva.hora_inicio_original || reserva.hora_inicio;
    const canchaOriginal = reserva.cancha_id;

    // Actualizar reserva
    const datosActualizacion = {
      cancha_id: canchaIdFinal,
      fecha: fechaFinal,
      hora_inicio: horaInicioFinal + ':00',
      monto_total: nuevoMontoTotal,
      // monto_abono SE MANTIENE (el cliente ya pagó)
      fecha_original: fechaOriginal,
      hora_inicio_original: horaOriginal,
      motivo_movimiento: motivo || 'Reprogramación manual',
      movida_por_id: userId,
      movida_at: new Date(),
      updated_at: new Date()
    };

    await reserva.update(datosActualizacion);

    // Calcular nuevo saldo pendiente
    const nuevoSaldoPendiente = nuevoMontoTotal - montoAbonoActual;

    return res.status(200).json({
      success: true,
      message: 'Reserva reprogramada exitosamente',
      data: {
        id: reserva.id,
        cancha_anterior: canchaOriginal,
        fecha_anterior: fechaOriginal,
        hora_anterior: horaOriginal,
        nueva_cancha_id: canchaIdFinal,
        nueva_fecha: fechaFinal,
        nueva_hora_inicio: horaInicioFinal,
        nueva_hora_fin: horaFin,
        monto_total_anterior: parseFloat(reserva.monto_total),
        monto_total_nuevo: nuevoMontoTotal,
        monto_abono: montoAbonoActual,
        saldo_pendiente: nuevoSaldoPendiente,
        diferencia_precio: nuevoMontoTotal - parseFloat(reserva.monto_total),
        motivo: motivo || 'Reprogramación manual',
        movida_por: userId,
        movida_at: datosActualizacion.movida_at
      }
    });

  } catch (error) {
    console.error('Error en moverReserva:', error);
    return res.status(500).json({ success: false, message: 'Error al mover la reserva', error: error.message });
  }
};

/**
 * PATCH /api/reservas/:id/pago-total
 * Registrar que la reserva fue pagada en su totalidad. Solo el dueño del complejo.
 *
 * Body (opcional):
 * {
 *   "metodo_pago": "EFECTIVO"
 * }
 */
export const registrarPagoTotal = async (req, res) => {
  try {
    const userId = req.user.id;
    const reservaId = parseInt(req.params.id);
    const { metodo_pago } = req.body;

    const reserva = await Reservas.findByPk(reservaId, {
      include: [{
        model: Canchas,
        as: 'cancha',
        include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'dueño_id'] }]
      }]
    });

    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    if (reserva.cancha?.complejo?.dueño_id !== userId) {
      return res.status(403).json({ success: false, message: 'Solo el dueño del complejo puede registrar pagos' });
    }

    if (reserva.estado_pago === 'PAGADA_TOTAL') {
      return res.status(400).json({ success: false, message: 'Esta reserva ya fue pagada en su totalidad' });
    }

    if (reserva.estado_reserva === 'CANCELADA') {
      return res.status(400).json({ success: false, message: 'No se puede registrar pago de una reserva cancelada' });
    }

    const updateData = {
      estado_pago: 'PAGADA_TOTAL',
      monto_abono: reserva.monto_total,
      updated_at: new Date()
    };
    if (metodo_pago) updateData.metodo_pago = metodo_pago;

    await reserva.update(updateData);

    return res.status(200).json({
      success: true,
      message: 'Pago total registrado exitosamente',
      data: {
        id: reserva.id,
        monto_total: parseFloat(reserva.monto_total),
        estado_pago: 'PAGADA_TOTAL',
        metodo_pago: updateData.metodo_pago || reserva.metodo_pago,
        saldo_pendiente: 0
      }
    });

  } catch (error) {
    console.error('Error en registrarPagoTotal:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar el pago', error: error.message });
  }
};

/**
 * PATCH /api/reservas/:id/cancelar
 * Cancelar una reserva. El propio usuario o el dueño del complejo pueden cancelar.
 */
export const cancelarReserva = async (req, res) => {
  try {
    const userId = req.user.id;
    const reservaId = parseInt(req.params.id);

    const reserva = await Reservas.findByPk(reservaId, {
      include: [{
        model: Canchas,
        as: 'cancha',
        include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'dueño_id'] }]
      }]
    });

    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    const esPropietario = reserva.user_id === userId;
    const esDueno = reserva.cancha?.complejo?.dueño_id === userId;

    if (!esPropietario && !esDueno) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para cancelar esta reserva' });
    }

    if (reserva.estado_reserva === 'CANCELADA') {
      return res.status(400).json({ success: false, message: 'Esta reserva ya está cancelada' });
    }

    if (reserva.estado_reserva === 'FINALIZADA') {
      return res.status(400).json({ success: false, message: 'No se puede cancelar una reserva finalizada' });
    }

    await reserva.update({
      estado_reserva: 'CANCELADA',
      estado_pago: 'CANCELADA',
      cancelada_por_id: userId,
      cancelada_at: new Date(),
      updated_at: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Reserva cancelada exitosamente',
      data: {
        id: reserva.id,
        estado_reserva: 'CANCELADA',
        estado_pago: 'CANCELADA',
        cancelada_por: esDueno ? 'dueño_complejo' : 'usuario',
        nota: 'La política de devolución del abono se gestiona por fuera del sistema'
      }
    });

  } catch (error) {
    console.error('Error en cancelarReserva:', error);
    return res.status(500).json({ success: false, message: 'Error al cancelar la reserva', error: error.message });
  }
};

/**
 * GET /api/reservas/disponibilidad/:canchaId
 * Consulta pública de disponibilidad de una cancha para una fecha dada.
 * No requiere autenticación.
 *
 * Query: ?fecha=2026-05-20
 */
/**
 * GET /api/reservas/historial-cliente/:telefono
 * Obtiene el historial de reservas de un cliente por su teléfono.
 * Solo dueños de complejos pueden consultar.
 */
export const getHistorialCliente = async (req, res) => {
  try {
    const userId = req.user.id;
    const { telefono } = req.params;
    const { complejo_id } = req.query;

    if (!telefono) {
      return res.status(400).json({ success: false, message: 'El teléfono es obligatorio' });
    }

    if (!complejo_id) {
      return res.status(400).json({ success: false, message: 'El complejo_id es obligatorio' });
    }

    // Verificar que el usuario sea dueño del complejo
    const complejo = await Complejos.findByPk(complejo_id);
    if (!complejo) {
      return res.status(404).json({ success: false, message: 'Complejo no encontrado' });
    }

    if (complejo.dueño_id !== userId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para consultar este historial' });
    }

    // Normalizar teléfono (eliminar caracteres no numéricos)
    const telefonoNormalizado = telefono.replace(/\D/g, '');

    // 1. Buscar usuario registrado por teléfono
    const usuario = await User.findOne({
      where: {
        [Op.or]: [
          { telefono: { [Op.like]: `%${telefonoNormalizado}%` } },
          { telefono: telefono }
        ]
      },
      attributes: ['id', 'name', 'email', 'telefono']
    });

    // 2. Buscar reservas usando JOIN con canchas para filtrar por complejo_id
    const condicionesReserva = [];

    // Si el usuario está registrado, buscar por user_id
    if (usuario) {
      condicionesReserva.push({ user_id: usuario.id });
    }

    // Siempre buscar también por telefono_contacto (reservas manuales)
    condicionesReserva.push({
      [Op.or]: [
        { telefono_contacto: { [Op.like]: `%${telefonoNormalizado}%` } },
        { telefono_contacto: telefono }
      ]
    });

    const reservas = await Reservas.findAll({
      where: {
        [Op.or]: condicionesReserva
      },
      include: [
        {
          model: Canchas,
          as: 'cancha',
          attributes: ['id', 'nombre', 'tipo_deporte', 'complejo_id'],
          where: { complejo_id: complejo_id }, // FILTRAR POR COMPLEJO
          required: true // INNER JOIN para asegurar que solo traiga del complejo correcto
        },
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'name', 'email', 'telefono'],
          required: false // LEFT JOIN porque puede no tener usuario
        }
      ],
      order: [['fecha', 'DESC'], ['hora_inicio', 'DESC']]
    });

    // 3. Calcular estadísticas
    const totalReservas = reservas.length;
    const reservasCanceladas = reservas.filter(r => r.estado_reserva === 'CANCELADA').length;
    const reservasNoShow = reservas.filter(r => r.estado_reserva === 'NO_SHOW').length;
    const reservasFinalizadas = reservas.filter(r => r.estado_reserva === 'FINALIZADA').length;
    const reservasConfirmadas = reservas.filter(r => r.estado_reserva === 'CONFIRMADA').length;

    // 4. Preparar datos del cliente
    const nombreCliente = usuario?.name 
      || reservas.find(r => r.nombre_contacto)?.nombre_contacto 
      || 'Cliente nuevo';

    const datosCliente = {
      telefono: telefono,
      nombre: nombreCliente,
      email: usuario?.email || null,
      user_id: usuario?.id || null,
      es_cliente_registrado: !!usuario
    };

    // 5. Mapear historial
    const historial = reservas.map(r => ({
      id: r.id,
      cancha: r.cancha?.nombre || 'Sin cancha',
      tipo_deporte: r.cancha?.tipo_deporte || null,
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      hora_fin: calcularHoraFin(r.hora_inicio, r.duracion_minutos),
      duracion_minutos: r.duracion_minutos,
      monto_total: parseFloat(r.monto_total || 0),
      estado_pago: r.estado_pago,
      estado_reserva: r.estado_reserva,
      origen_reserva: r.origen_reserva || 'WEB',
      creado_at: r.creado_at,
      fue_cancelada: r.estado_reserva === 'CANCELADA',
      fue_no_show: r.estado_reserva === 'NO_SHOW'
    }));

    const tieneIncumplimientos = reservasCanceladas > 0 || reservasNoShow > 0;

    return res.status(200).json({
      success: true,
      cliente: datosCliente,
      estadisticas: {
        total_reservas: totalReservas,
        reservas_finalizadas: reservasFinalizadas,
        reservas_confirmadas: reservasConfirmadas,
        reservas_canceladas: reservasCanceladas,
        reservas_no_show: reservasNoShow,
        tiene_incumplimientos: tieneIncumplimientos,
        tasa_cumplimiento: totalReservas > 0 
          ? Math.round((reservasFinalizadas / totalReservas) * 100) 
          : 100
      },
      historial: historial
    });

  } catch (error) {
    console.error('Error en getHistorialCliente:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener historial del cliente', 
      error: error.message 
    });
  }
};

export const getDisponibilidad = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.canchaId);
    const { fecha } = req.query;

    if (!fecha) {
      return res.status(400).json({ success: false, message: 'El parámetro fecha es obligatorio' });
    }

    const cancha = await Canchas.findByPk(canchaId, {
      include: [{ model: Complejos, as: 'complejo', attributes: ['id', 'nombre'] }]
    });

    if (!cancha) {
      return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
    }

    // Reservas activas para esa fecha
    const reservasActivas = await Reservas.findAll({
      where: {
        cancha_id: canchaId,
        fecha,
        estado_reserva: { [Op.notIn]: ['CANCELADA'] }
      },
      attributes: ['id', 'hora_inicio', 'duracion_minutos', 'estado_reserva'],
      order: [['hora_inicio', 'ASC']]
    });

    const horariosOcupados = reservasActivas.map(r => ({
      hora_inicio: r.hora_inicio,
      hora_fin: calcularHoraFin(r.hora_inicio, r.duracion_minutos),
      duracion_minutos: r.duracion_minutos
    }));

    // Obtener horario del complejo para ese día
    const fechaObj = new Date(fecha + 'T00:00:00');
    const diaSemana = fechaObj.getDay();

    const horarioComplejo = await ComplejoHorarios.findOne({
      where: { complejo_id: cancha.complejo_id, dia_semana: diaSemana }
    });

    // Verificar excepción (festivo o cierre)
    const excepcion = await CalendarioExcepciones.findOne({
      where: { complejo_id: cancha.complejo_id, fecha }
    });

    const estaAbierto = excepcion ? excepcion.esta_abierto : (horarioComplejo ? !horarioComplejo.esta_cerrado : true);

    return res.status(200).json({
      success: true,
      data: {
        cancha_id: canchaId,
        cancha_nombre: cancha.nombre,
        complejo: cancha.complejo?.nombre,
        fecha,
        esta_abierto: estaAbierto,
        es_festivo: excepcion?.es_festivo || false,
        horario_apertura: horarioComplejo?.hora_apertura || null,
        horario_cierre: horarioComplejo?.hora_cierre || null,
        horarios_ocupados: horariosOcupados,
        total_reservas_activas: horariosOcupados.length
      }
    });

  } catch (error) {
    console.error('Error en getDisponibilidad:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar disponibilidad', error: error.message });
  }
};
