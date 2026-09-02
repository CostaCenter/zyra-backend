import {
  searchCourts,
  getSearchStats,
  searchCourtsWithPagination
} from '../services/searchService.js';

/**
 * Controller de Exploración y Búsqueda - Zyra
 * Maneja las peticiones HTTP para búsqueda y exploración de canchas disponibles
 */

/**
 * GET /api/explorar/canchas
 * Buscar canchas disponibles con filtros flexibles
 * Query params:
 *  - q: búsqueda de texto (nombre de cancha o complejo)
 *  - deporte: nombre del deporte (búsqueda flexible)
 *  - sport_id: ID del deporte (filtro estricto)
 *  - fecha: fecha en formato YYYY-MM-DD
 *  - ubicacion: ubicación del complejo
 *  - estado: estado de la cancha (DISPONIBLE, OCUPADA, etc.)
 * 
 * Ruta pública (no requiere autenticación)
 */
export const buscarCanchas = async (req, res) => {
  try {
    const {
      q,
      deporte,
      sport_id,
      fecha,
      ubicacion,
      estado
    } = req.query;

    // Validaciones opcionales
    if (fecha) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(fecha)) {
        return res.status(400).json({
          success: false,
          message: 'El formato de fecha debe ser YYYY-MM-DD'
        });
      }
    }

    if (sport_id && isNaN(parseInt(sport_id))) {
      return res.status(400).json({
        success: false,
        message: 'El sport_id debe ser un número válido'
      });
    }

    // Construir objeto de filtros
    const filters = {};
    if (q) filters.q = q;
    if (deporte) filters.deporte = deporte;
    if (sport_id) filters.sport_id = sport_id;
    if (fecha) filters.fecha = fecha;
    if (ubicacion) filters.ubicacion = ubicacion;
    if (estado) filters.estado = estado;

    // Ejecutar búsqueda
    const canchas = await searchCourts(filters);

    res.status(200).json({
      success: true,
      message: 'Búsqueda completada exitosamente',
      data: canchas,
      count: canchas.length,
      filters: filters // Devolver los filtros aplicados
    });

  } catch (error) {
    console.error('Error en explorarController.buscarCanchas:', error);

    res.status(500).json({
      success: false,
      message: 'Error al buscar canchas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/explorar/canchas/paginado
 * Buscar canchas con paginación
 * Query params:
 *  - q, deporte, sport_id, fecha, ubicacion, estado (filtros)
 *  - page: número de página (default: 1)
 *  - limit: límite por página (default: 10)
 * 
 * Ruta pública
 */
export const buscarCanchasPaginado = async (req, res) => {
  try {
    const {
      q,
      deporte,
      sport_id,
      fecha,
      ubicacion,
      estado,
      page = 1,
      limit = 10
    } = req.query;

    // Validaciones
    if (fecha) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(fecha)) {
        return res.status(400).json({
          success: false,
          message: 'El formato de fecha debe ser YYYY-MM-DD'
        });
      }
    }

    if (sport_id && isNaN(parseInt(sport_id))) {
      return res.status(400).json({
        success: false,
        message: 'El sport_id debe ser un número válido'
      });
    }

    if (isNaN(parseInt(page)) || parseInt(page) < 1) {
      return res.status(400).json({
        success: false,
        message: 'El número de página debe ser mayor o igual a 1'
      });
    }

    if (isNaN(parseInt(limit)) || parseInt(limit) < 1 || parseInt(limit) > 100) {
      return res.status(400).json({
        success: false,
        message: 'El límite debe estar entre 1 y 100'
      });
    }

    // Construir objeto de filtros
    const filters = {};
    if (q) filters.q = q;
    if (deporte) filters.deporte = deporte;
    if (sport_id) filters.sport_id = sport_id;
    if (fecha) filters.fecha = fecha;
    if (ubicacion) filters.ubicacion = ubicacion;
    if (estado) filters.estado = estado;

    // Opciones de paginación
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Ejecutar búsqueda con paginación
    const result = await searchCourtsWithPagination(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Búsqueda paginada completada exitosamente',
      data: result.data,
      pagination: result.pagination,
      filters: filters
    });

  } catch (error) {
    console.error('Error en explorarController.buscarCanchasPaginado:', error);

    res.status(500).json({
      success: false,
      message: 'Error al buscar canchas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/explorar/estadisticas
 * Obtener estadísticas de búsqueda
 * Query params: mismos filtros que buscarCanchas
 * 
 * Ruta pública
 */
export const obtenerEstadisticas = async (req, res) => {
  try {
    const {
      q,
      deporte,
      sport_id,
      fecha,
      ubicacion,
      estado
    } = req.query;

    // Construir objeto de filtros
    const filters = {};
    if (q) filters.q = q;
    if (deporte) filters.deporte = deporte;
    if (sport_id) filters.sport_id = sport_id;
    if (fecha) filters.fecha = fecha;
    if (ubicacion) filters.ubicacion = ubicacion;
    if (estado) filters.estado = estado;

    // Obtener estadísticas
    const stats = await getSearchStats(filters);

    res.status(200).json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: stats,
      filters: filters
    });

  } catch (error) {
    console.error('Error en explorarController.obtenerEstadisticas:', error);

    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/explorar/deportes
 * Listar todos los deportes disponibles con sus canchas
 * 
 * Ruta pública
 */
export const listarDeportes = async (req, res) => {
  try {
    const { Sports, Canchas } = await import('../db/db.js');

    const deportes = await Sports.findAll({
      attributes: ['id', 'name', 'state'],
      include: [
        {
          model: Canchas,
          as: 'canchas',
          attributes: ['id'],
          required: false
        }
      ],
      order: [['name', 'ASC']]
    });

    // Formatear respuesta con conteo de canchas
    const deportesConConteo = deportes.map(deporte => ({
      id: deporte.id,
      name: deporte.name,
      state: deporte.state,
      totalCanchas: deporte.canchas ? deporte.canchas.length : 0
    }));

    res.status(200).json({
      success: true,
      message: 'Deportes listados exitosamente',
      data: deportesConConteo,
      count: deportesConConteo.length
    });

  } catch (error) {
    console.error('Error en explorarController.listarDeportes:', error);

    res.status(500).json({
      success: false,
      message: 'Error al listar deportes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/explorar/complejos
 * Lista complejos que tienen canchas disponibles, con filtros, paginación y
 * disponibilidad real basada en reservas activas.
 *
 * Query params:
 *  - q          : búsqueda por nombre de complejo O nombre de cancha
 *  - sport_id   : ID del deporte (filtro estricto)
 *  - deporte    : tipo de deporte texto (búsqueda flexible)
 *  - fecha      : fecha YYYY-MM-DD — extrae el día automáticamente y activa
 *                 la validación de reservas (reemplaza/complementa `dia`)
 *  - hora_inicio: HH:MM — inicio del rango horario deseado
 *  - hora_fin   : HH:MM — fin del rango (opcional; default hora_inicio + 60 min)
 *  - dia        : día de la semana 0-6 (Dom=0…Sab=6) — usado si no hay fecha
 *  - ubicacion  : ciudad/ubicación del complejo
 *  - precio_min : precio mínimo por hora
 *  - precio_max : precio máximo por hora
 *  - page       : página (default: 1)
 *  - limit      : resultados por página (default: 10, máx: 50)
 *
 * Estrategia de consulta (4 a 5 queries lean):
 *  0. [Solo si fecha+hora] IDs de canchas ocupadas en ese rango → excluidas de todo
 *  1. IDs de todos los complejos que califican → paginación en memoria
 *  2. Detalles de los complejos de la página actual
 *  3. Conteo de canchas libres (ya sin las ocupadas) y precio rango por complejo
 *  4. Horarios del complejo para mostrar en la respuesta
 *
 * Ruta pública
 */
export const buscarComplejos = async (req, res) => {
  try {
    const {
      q,
      sport_id,
      deporte,
      dia,
      fecha,
      hora_inicio,
      hora_fin,
      ubicacion,
      precio_min,
      precio_max,
      page  = 1,
      limit = 10
    } = req.query;

    const {
      sequelize: seq,
      Complejos, Canchas, ComplejoHorarios, CanchaHorariosPrecios, Reservas, Sequelize
    } = await import('../db/db.js');
    const { Op, fn, col } = Sequelize;

    // ── Validaciones ──────────────────────────────────────────────────────────
    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const offset   = (pageNum - 1) * limitNum;

    if (sport_id  && isNaN(parseInt(sport_id)))
      return res.status(400).json({ success: false, message: 'sport_id debe ser un número válido' });
    if (precio_min && isNaN(parseFloat(precio_min)))
      return res.status(400).json({ success: false, message: 'precio_min debe ser un número válido' });
    if (precio_max && isNaN(parseFloat(precio_max)))
      return res.status(400).json({ success: false, message: 'precio_max debe ser un número válido' });
    if (precio_min && precio_max && parseFloat(precio_min) > parseFloat(precio_max))
      return res.status(400).json({ success: false, message: 'precio_min no puede ser mayor que precio_max' });

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (hora_inicio && !timeRegex.test(hora_inicio))
      return res.status(400).json({ success: false, message: 'hora_inicio debe tener formato HH:MM' });
    if (hora_fin && !timeRegex.test(hora_fin))
      return res.status(400).json({ success: false, message: 'hora_fin debe tener formato HH:MM' });
    if (fecha) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(fecha))
        return res.status(400).json({ success: false, message: 'fecha debe tener formato YYYY-MM-DD' });
    }

    // ── Normalizar día ─────────────────────────────────────────────────────────
    // `fecha` tiene prioridad sobre `dia`; si hay fecha se extrae el día automáticamente.
    let diaNum = null;
    let fechaNormalizada = fecha || null;

    if (fechaNormalizada) {
      const dateObj = new Date(`${fechaNormalizada}T12:00:00Z`);
      if (!isNaN(dateObj.getTime())) diaNum = dateObj.getUTCDay();
    } else if (dia !== undefined && dia !== '') {
      const parsed = parseInt(dia);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
        diaNum = parsed;
      } else {
        const dateObj = new Date(`${dia}T12:00:00Z`);
        if (!isNaN(dateObj.getTime())) {
          diaNum = dateObj.getUTCDay();
          fechaNormalizada = dia;
        } else {
          return res.status(400).json({
            success: false,
            message: 'dia debe ser 0-6 (Dom=0, Sab=6) o una fecha YYYY-MM-DD'
          });
        }
      }
    }

    // ── Normalizar rango horario ───────────────────────────────────────────────
    // Si hay hora_inicio pero no hora_fin → ventana de 60 minutos por defecto.
    let horaIniStr = null;
    let horaFinStr = null;
    const consultaPorHora = !!(fechaNormalizada && hora_inicio);

    if (consultaPorHora) {
      horaIniStr = hora_inicio + ':00';
      if (hora_fin) {
        horaFinStr = hora_fin + ':00';
        if (horaFinStr <= horaIniStr)
          return res.status(400).json({ success: false, message: 'hora_fin debe ser posterior a hora_inicio' });
      } else {
        // Default: +60 minutos
        const [h, m] = hora_inicio.split(':').map(Number);
        const total  = h * 60 + m + 60;
        horaFinStr   = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-FASE 0 — Canchas ocupadas en ese rango horario (solo si fecha+hora)
    //
    // Una reserva activa entra en conflicto con [horaIni, horaFin) si:
    //   reserva.hora_inicio < horaFin   (empieza antes que termine la ventana)
    //   AND
    //   reserva.hora_inicio + duracion_minutos > horaIni  (termina después de que inicia)
    //
    // La segunda condición usa un literal PostgreSQL con aritmética de intervalos.
    // ══════════════════════════════════════════════════════════════════════════
    let occupiedCanchaIds  = [];           // cancha_ids con conflicto
    const occupiedByComplejo = {};         // complejo_id → número de canchas ocupadas

    if (consultaPorHora) {
      const ocupadas = await Reservas.findAll({
        where: {
          fecha:         fechaNormalizada,
          estado_reserva: { [Op.notIn]: ['CANCELADA'] },
          hora_inicio:   { [Op.lt]: horaFinStr },
          [Op.and]: [
            seq.literal(
              `hora_inicio + (duracion_minutos * interval '1 minute') > '${horaIniStr}'`
            )
          ]
        },
        attributes: ['cancha_id'],
        include: [{
          model:      Canchas,
          as:         'cancha',
          attributes: ['complejo_id'],
          required:   true
        }],
        raw:   true,
        nest:  true
      });

      occupiedCanchaIds = [...new Set(ocupadas.map(r => r.cancha_id))];

      // Mapa complejo_id → canchas ocupadas (para la respuesta)
      ocupadas.forEach(r => {
        const cid = r.cancha?.complejo_id;
        if (cid) occupiedByComplejo[cid] = (occupiedByComplejo[cid] || 0) + 1;
      });
    }

    // ── WHERE: canchas ────────────────────────────────────────────────────────
    // Excluye canchas con estado != DISPONIBLE y, si hay hora, las ya ocupadas.
    const canchasWhere = {
      state: 'DISPONIBLE',
      ...(sport_id ? { sport_id: parseInt(sport_id) }                 : {}),
      ...(deporte  ? { tipo_deporte: { [Op.iLike]: `%${deporte}%` } } : {}),
      ...(precio_min || precio_max ? {
        precio_hora: {
          ...(precio_min ? { [Op.gte]: parseFloat(precio_min) } : {}),
          ...(precio_max ? { [Op.lte]: parseFloat(precio_max) } : {})
        }
      } : {}),
      // Excluir canchas ocupadas: si la lista está vacía Op.notIn([]) no aplica
      ...(occupiedCanchaIds.length > 0 ? { id: { [Op.notIn]: occupiedCanchaIds } } : {})
    };

    // ── Include: cancha_horarios_precios ─────────────────────────────────────
    // Filtra que la cancha tenga precio configurado para ese día.
    // Si además hay hora solicitada, la franja debe cubrir COMPLETAMENTE el
    // rango pedido: hora_inicio_franja <= hora_pedida AND hora_fin_franja >= fin_pedido.
    // Esto garantiza que el precio que se devuelve corresponde a la franja real
    // del horario consultado, no a cualquier franja del día.
    const horarioPrecioWhere = diaNum !== null
      ? {
          tipo_dia: diaNum,
          ...(consultaPorHora ? {
            hora_inicio: { [Op.lte]: horaIniStr },
            hora_fin:    { [Op.gte]: horaFinStr }
          } : {})
        }
      : null;

    // Ambas fases usan el mismo include con attributes vacío.
    // Los MIN/MAX del precio se referencian vía col() en el parent (válido en PostgreSQL).
    const horariosInclude = horarioPrecioWhere ? [{
      model:      CanchaHorariosPrecios,
      as:         'horariosPrecios',
      where:      horarioPrecioWhere,
      required:   true,
      attributes: []
    }] : [];

    const horariosIncludeConPrecio = horariosInclude;

    // ── Include: complejo_horarios (el recinto debe estar abierto ese día) ────
    const complejoHorariosFilterInclude = diaNum !== null ? [{
      model:      ComplejoHorarios,
      as:         'horarios',
      where:      { dia_semana: diaNum, esta_cerrado: false },
      required:   true,
      attributes: []
    }] : [];

    // ── WHERE: complejos ──────────────────────────────────────────────────────
    const complejosWhere = {
      ...(ubicacion ? { ubicacion: { [Op.iLike]: `%${ubicacion}%` } } : {}),
      ...(q ? {
        [Op.or]: [
          { nombre:             { [Op.iLike]: `%${q}%` } },
          { '$canchas.nombre$': { [Op.iLike]: `%${q}%` } }
        ]
      } : {})
    };

    const filterIncludes = [
      {
        model:      Canchas,
        as:         'canchas',
        where:      canchasWhere,
        required:   true,
        attributes: [],
        include:    horariosInclude
      },
      ...complejoHorariosFilterInclude
    ];

    // ══════════════════════════════════════════════════════════════════════════
    // FASE 1 — IDs de TODOS los complejos con al menos una cancha libre
    //          GROUP BY elimina duplicados por JOINs hasMany.
    //          Ordenados por nombre → paginación en memoria → total correcto.
    // ══════════════════════════════════════════════════════════════════════════
    const idRows = await Complejos.findAll({
      where:      complejosWhere,
      include:    filterIncludes,
      attributes: ['id'],
      group:      ['complejos.id'],
      order:      [['nombre', 'ASC']],
      subQuery:   false,
      raw:        true
    });

    const total      = idRows.length;
    const totalPages = Math.ceil(total / limitNum);

    if (total === 0) {
      const mensajeVacio = consultaPorHora
        ? `No se encontraron complejos con canchas libres el ${fechaNormalizada} de ${hora_inicio} a ${hora_fin || _sumarMinutos(hora_inicio, 60).substring(0, 5)}`
        : 'No se encontraron complejos con canchas disponibles para los filtros indicados';
      return res.status(200).json({
        success: true,
        message: mensajeVacio,
        data: [],
        pagination:       { page: pageNum, limit: limitNum, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        filtrosAplicados: _buildFiltros({ q, sport_id, deporte, diaNum, fechaNormalizada, hora_inicio, hora_fin, ubicacion, precio_min, precio_max })
      });
    }

    const paginatedIds = idRows.slice(offset, offset + limitNum).map(r => r.id);

    // ══════════════════════════════════════════════════════════════════════════
    // FASE 2 — Detalles del complejo para la página actual
    // ══════════════════════════════════════════════════════════════════════════
    const complejos = await Complejos.findAll({
      where:      { id: { [Op.in]: paginatedIds } },
      attributes: ['id', 'nombre', 'ubicacion', 'photo', 'wallpaper']
    });

    // ══════════════════════════════════════════════════════════════════════════
    // FASE 3 — Conteo de canchas LIBRES por complejo (canchasWhere ya excluye
    //          las ocupadas) + rango de precios
    //
    // IMPORTANTE: Usamos COUNT(DISTINCT canchas.id) para evitar duplicados cuando
    // una cancha tiene múltiples franjas horarias para el mismo día.
    // Los precios vienen de cancha_horarios_precios si hay filtro de día, o de
    // la tabla canchas si no hay filtro temporal.
    // ══════════════════════════════════════════════════════════════════════════
    const canchaCountRows = await Canchas.findAll({
      where: {
        complejo_id: { [Op.in]: paginatedIds },
        ...canchasWhere
      },
      attributes: [
        'complejo_id',
        [fn('COUNT', fn('DISTINCT', col('canchas.id'))), 'canchasLibres'],
        // Si hay filtro de día, tomar precios de cancha_horarios_precios
        ...(diaNum !== null ? [
          [fn('MIN',   col('horariosPrecios.precio_hora')), 'precioDesde'],
          [fn('MAX',   col('horariosPrecios.precio_hora')), 'precioHasta']
        ] : [
          [fn('MIN',   col('canchas.precio_hora')), 'precioDesde'],
          [fn('MAX',   col('canchas.precio_hora')), 'precioHasta']
        ])
      ],
      include: horariosIncludeConPrecio,
      group:   ['canchas.complejo_id'],
      raw:     true
    });

    const countMap = {};
    canchaCountRows.forEach(c => {
      countMap[c.complejo_id] = {
        canchasLibres: parseInt(c.canchasLibres || 0),
        precioDesde:   parseFloat(c.precioDesde || 0),
        precioHasta:   parseFloat(c.precioHasta || 0)
      };
    });

    // ══════════════════════════════════════════════════════════════════════════
    // FASE 4 — Horarios del complejo (para mostrar, no para filtrar)
    // ══════════════════════════════════════════════════════════════════════════
    const horariosRows = await ComplejoHorarios.findAll({
      where: {
        complejo_id: { [Op.in]: paginatedIds },
        esta_cerrado: false
      },
      attributes: ['complejo_id', 'dia_semana', 'hora_apertura', 'hora_cierre'],
      order:       [['dia_semana', 'ASC']],
      raw:         true
    });

    const horariosMap = {};
    horariosRows.forEach(h => {
      if (!horariosMap[h.complejo_id]) horariosMap[h.complejo_id] = [];
      horariosMap[h.complejo_id].push({
        dia:      h.dia_semana,
        apertura: h.hora_apertura,
        cierre:   h.hora_cierre
      });
    });

    // ── Armar respuesta preservando el orden paginado ─────────────────────────
    const data = paginatedIds.map(id => {
      const complejo = complejos.find(c => c.id === id);
      const counts   = countMap[id] || { canchasLibres: 0, precioDesde: 0, precioHasta: 0 };
      const base = {
        id:            complejo.id,
        nombre:        complejo.nombre,
        ubicacion:     complejo.ubicacion,
        photo:         complejo.photo,
        wallpaper:     complejo.wallpaper,
        canchasLibres: counts.canchasLibres,
        precioDesde:   counts.precioDesde,
        precioHasta:   counts.precioHasta,
        horarios:      horariosMap[id] || []
      };

      // Si se consultó por fecha+hora, agregar info de ocupación
      if (consultaPorHora) {
        base.canchasOcupadas      = occupiedByComplejo[id] || 0;
        base.disponibilidadHoraria = {
          fecha:       fechaNormalizada,
          hora_inicio: hora_inicio,
          hora_fin:    hora_fin || horaFinStr.substring(0, 5),
          libres:      counts.canchasLibres,
          ocupadas:    occupiedByComplejo[id] || 0
        };
      }

      return base;
    });

    // Construir mensaje descriptivo
    const msgHora = consultaPorHora
      ? ` con canchas libres el ${fechaNormalizada} de ${hora_inicio} a ${hora_fin || horaFinStr.substring(0, 5)}`
      : ' con canchas disponibles';

    return res.status(200).json({
      success: true,
      message: `${total} complejo(s) encontrado(s)${msgHora}`,
      data,
      pagination: {
        page:        pageNum,
        limit:       limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filtrosAplicados: _buildFiltros({ q, sport_id, deporte, diaNum, fechaNormalizada, hora_inicio, hora_fin, ubicacion, precio_min, precio_max })
    });

  } catch (error) {
    console.error('Error en explorarController.buscarComplejos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al buscar complejos disponibles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/explorar/ubicaciones
 * Listar todas las ubicaciones disponibles
 * 
 * Ruta pública
 */
export const listarUbicaciones = async (req, res) => {
  try {
    const { Complejos, Canchas } = await import('../db/db.js');
    const { fn, col } = await import('sequelize');

    // Obtener ubicaciones únicas con conteo de canchas
    const ubicaciones = await Complejos.findAll({
      attributes: [
        'ubicacion',
        [fn('COUNT', col('canchas.id')), 'totalCanchas']
      ],
      include: [
        {
          model: Canchas,
          as: 'canchas',
          attributes: [],
          required: false
        }
      ],
      group: ['Complejos.ubicacion'],
      having: {
        ubicacion: {
          [require('sequelize').Op.ne]: null
        }
      },
      order: [['ubicacion', 'ASC']]
    });

    const ubicacionesFormateadas = ubicaciones.map(item => ({
      ubicacion: item.ubicacion,
      totalCanchas: parseInt(item.get('totalCanchas') || 0)
    }));

    res.status(200).json({
      success: true,
      message: 'Ubicaciones listadas exitosamente',
      data: ubicacionesFormateadas,
      count: ubicacionesFormateadas.length
    });

  } catch (error) {
    console.error('Error en explorarController.listarUbicaciones:', error);

    res.status(500).json({
      success: false,
      message: 'Error al listar ubicaciones',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/explorar/complejos/:complejoId/disponibilidad
 * Obtener disponibilidad completa de canchas de un complejo para un día específico
 * 
 * Query params:
 *  - fecha       : YYYY-MM-DD (requerido)
 *  - sport_id    : filtrar por tipo de deporte (opcional)
 *  - deporte     : filtrar por nombre de deporte (opcional, búsqueda flexible)
 *  - hora_inicio : HH:MM (opcional, solo como referencia para resaltar en frontend)
 * 
 * Respuesta:
 *  - Información del complejo
 *  - Horarios del complejo para ese día
 *  - Lista de canchas con:
 *    - Detalles completos (superficie, capacidad, techado, etc.)
 *    - Wallpapers/fotos
 *    - TODAS las franjas horarias del día con estado (LIBRE/OCUPADA) y precio
 * 
 * Ruta pública
 */
export const obtenerDisponibilidadComplejo = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.complejoId);
    const { fecha, sport_id, deporte, hora_inicio } = req.query;

    const {
      sequelize: seq,
      Complejos, Canchas, ComplejoHorarios, CanchaHorariosPrecios, 
      Reservas, Sports, DetailsCanchas, WallpaperCanchas, Sequelize
    } = await import('../db/db.js');
    const { Op } = Sequelize;

    // ── Validaciones ──────────────────────────────────────────────────────────
    if (isNaN(complejoId)) {
      return res.status(400).json({
        success: false,
        message: 'El ID del complejo debe ser un número válido'
      });
    }

    if (!fecha) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro "fecha" es requerido (formato YYYY-MM-DD)'
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'fecha debe tener formato YYYY-MM-DD'
      });
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (hora_inicio && !timeRegex.test(hora_inicio)) {
      return res.status(400).json({
        success: false,
        message: 'hora_inicio debe tener formato HH:MM (si se proporciona)'
      });
    }

    // ── Verificar que el complejo existe ──────────────────────────────────────
    const complejo = await Complejos.findByPk(complejoId, {
      attributes: ['id', 'nombre', 'ubicacion', 'photo', 'wallpaper']
    });

    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    // ── Calcular día de la semana ─────────────────────────────────────────────
    const dateObj = new Date(`${fecha}T12:00:00Z`);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha inválida'
      });
    }
    const diaNum = dateObj.getUTCDay();

    // ── Verificar horarios del complejo ───────────────────────────────────────
    const horarioComplejo = await ComplejoHorarios.findOne({
      where: {
        complejo_id: complejoId,
        dia_semana: diaNum,
        esta_cerrado: false
      }
    });

    if (!horarioComplejo) {
      return res.status(200).json({
        success: true,
        message: `El complejo está cerrado el día consultado (${fecha})`,
        data: {
          complejo: complejo.toJSON(),
          cerrado: true,
          fecha,
          dia_semana: diaNum,
          canchas: []
        }
      });
    }

    // ── Obtener todas las canchas del complejo con filtros ────────────────────
    const canchasWhere = {
      complejo_id: complejoId,
      state: 'DISPONIBLE',
      ...(sport_id ? { sport_id: parseInt(sport_id) } : {}),
      ...(deporte ? { tipo_deporte: { [Op.iLike]: `%${deporte}%` } } : {})
    };

    const todasCanchas = await Canchas.findAll({
      where: canchasWhere,
      attributes: ['id', 'nombre', 'tipo_deporte', 'sport_id', 'precio_hora', 'photo'],
      include: [
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name']
        },
        {
          model: DetailsCanchas,
          as: 'detalles',
          attributes: ['tipoSuperfice', 'tipoDeCancha', 'capacidadMaxima', 'techado', 'iluminacion', 'dimensiones', 'ubicacionInterna']
        },
        {
          model: WallpaperCanchas,
          as: 'wallpapers',
          attributes: ['id', 'img_url', 'description'],
          where: { state: true },
          required: false
        },
        {
          model: CanchaHorariosPrecios,
          as: 'horariosPrecios',
          where: { tipo_dia: diaNum },
          required: false,
          attributes: ['id', 'tipo_dia', 'hora_inicio', 'hora_fin', 'precio_hora']
        }
      ],
      order: [['nombre', 'ASC']]
    });

    if (todasCanchas.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay canchas disponibles con los filtros especificados',
        data: {
          complejo: complejo.toJSON(),
          horarioComplejo: {
            dia: diaNum,
            apertura: horarioComplejo.hora_apertura,
            cierre: horarioComplejo.hora_cierre
          },
          fecha,
          canchas: []
        }
      });
    }

    // ── Obtener TODAS las reservas activas de ese día ─────────────────────────
    const canchaIds = todasCanchas.map(c => c.id);
    const todasReservas = await Reservas.findAll({
      where: {
        cancha_id: { [Op.in]: canchaIds },
        fecha: fecha,
        estado_reserva: { [Op.notIn]: ['CANCELADA'] }
      },
      attributes: ['id', 'cancha_id', 'hora_inicio', 'duracion_minutos'],
      raw: true
    });

    // Mapa: cancha_id -> array de franjas ocupadas
    const reservasPorCancha = {};
    todasReservas.forEach(r => {
      if (!reservasPorCancha[r.cancha_id]) {
        reservasPorCancha[r.cancha_id] = [];
      }
      reservasPorCancha[r.cancha_id].push({
        inicio: r.hora_inicio,
        duracion: r.duracion_minutos
      });
    });

    // ── Construir respuesta con franjas horarias completas ────────────────────
    const canchasConDisponibilidad = todasCanchas.map(cancha => {
      const franjasHorarias = _generarFranjasHorarias(
        horarioComplejo.hora_apertura,
        horarioComplejo.hora_cierre,
        cancha.horariosPrecios || [],
        reservasPorCancha[cancha.id] || [],
        cancha.precio_hora
      );

      return {
        id: cancha.id,
        nombre: cancha.nombre,
        tipo_deporte: cancha.tipo_deporte,
        deporte: cancha.sport?.name || null,
        sport_id: cancha.sport_id,
        photo: cancha.photo,
        detalles: cancha.detalles ? {
          tipoSuperficie: cancha.detalles.tipoSuperfice,
          tipoDeCancha: cancha.detalles.tipoDeCancha,
          capacidadMaxima: cancha.detalles.capacidadMaxima,
          techado: cancha.detalles.techado,
          iluminacion: cancha.detalles.iluminacion,
          dimensiones: cancha.detalles.dimensiones,
          ubicacionInterna: cancha.detalles.ubicacionInterna
        } : null,
        wallpapers: cancha.wallpapers?.map(w => ({
          id: w.id,
          img_url: w.img_url,
          description: w.description
        })) || [],
        franjasHorarias: franjasHorarias,
        resumen: {
          total: franjasHorarias.length,
          libres: franjasHorarias.filter(f => f.estado === 'LIBRE').length,
          ocupadas: franjasHorarias.filter(f => f.estado === 'OCUPADA').length
        }
      };
    });

    return res.status(200).json({
      success: true,
      message: `Disponibilidad del complejo "${complejo.nombre}" para el ${fecha}`,
      data: {
        complejo: complejo.toJSON(),
        horarioComplejo: {
          dia: diaNum,
          apertura: horarioComplejo.hora_apertura,
          cierre: horarioComplejo.hora_cierre
        },
        fecha,
        hora_referencia: hora_inicio || null,
        totalCanchas: canchasConDisponibilidad.length,
        canchas: canchasConDisponibilidad
      }
    });

  } catch (error) {
    console.error('Error en explorarController.obtenerDisponibilidadComplejo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener disponibilidad del complejo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Genera todas las franjas horarias posibles entre apertura y cierre del complejo
 * con su disponibilidad y precio correspondiente
 */
function _generarFranjasHorarias(horaApertura, horaCierre, horariosPrecios, reservas, precioBase) {
  const franjas = [];
  
  // Convertir hora a minutos desde medianoche
  const horaToMinutes = (horaStr) => {
    const [h, m] = horaStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Convertir minutos a formato HH:MM
  const minutesToHora = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const inicioMin = horaToMinutes(horaApertura);
  const finMin = horaToMinutes(horaCierre);
  
  // Generar franjas de 60 minutos
  const duracionFranja = 60;
  
  for (let min = inicioMin; min < finMin; min += duracionFranja) {
    const horaIni = minutesToHora(min);
    const horaFin = minutesToHora(min + duracionFranja);
    const horaIniStr = `${horaIni}:00`;
    const horaFinStr = `${horaFin}:00`;

    // Buscar precio para esta franja
    let precio = precioBase;
    const horarioPrecio = horariosPrecios.find(hp => 
      hp.hora_inicio <= horaIniStr && hp.hora_fin >= horaFinStr
    );
    if (horarioPrecio) {
      precio = horarioPrecio.precio_hora;
    }

    // Verificar si está ocupada
    const estaOcupada = reservas.some(reserva => {
      const reservaInicioMin = horaToMinutes(reserva.inicio);
      const reservaFinMin = reservaInicioMin + reserva.duracion;
      
      // Hay conflicto si se solapan los rangos
      return (min < reservaFinMin && (min + duracionFranja) > reservaInicioMin);
    });

    franjas.push({
      hora_inicio: horaIni,
      hora_fin: horaFin,
      estado: estaOcupada ? 'OCUPADA' : 'LIBRE',
      precio: estaOcupada ? null : parseFloat(precio)
    });
  }

  return franjas;
}

// ── Helpers privados ──────────────────────────────────────────────────────────

/** Suma `minutos` a una hora en formato HH:MM y devuelve HH:MM:SS */
function _sumarMinutos(horaHHMM, minutos) {
  const [h, m] = horaHHMM.split(':').map(Number);
  const total  = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

function _buildFiltros({ q, sport_id, deporte, diaNum, fechaNormalizada, hora_inicio, hora_fin, ubicacion, precio_min, precio_max }) {
  const out = {};
  if (q)                  out.q          = q;
  if (sport_id)           out.sport_id   = parseInt(sport_id);
  if (deporte)            out.deporte    = deporte;
  if (diaNum !== null)    out.dia        = diaNum;
  if (fechaNormalizada)   out.fecha      = fechaNormalizada;
  if (hora_inicio)        out.hora_inicio = hora_inicio;
  if (hora_fin)           out.hora_fin   = hora_fin;
  if (ubicacion)          out.ubicacion  = ubicacion;
  if (precio_min)         out.precio_min = parseFloat(precio_min);
  if (precio_max)         out.precio_max = parseFloat(precio_max);
  return out;
}
