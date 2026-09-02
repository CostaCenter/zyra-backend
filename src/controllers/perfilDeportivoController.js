import { UsuarioStatsPorSport, Sports } from '../db/db.js';

const perfilPorDefecto = (userId, sportId) => ({
  user_id: userId,
  sport_id: sportId,
  elo_oficial: 1.0,
  goles_oficiales: 0,
  partidos_oficiales: 0,
  elo_casual: 1.0,
  goles_casuales: 0,
  partidos_casuales: 0,
  posicion_principal: null,
  pierna_habil: null,
  mano_habil: null,
  dorsal_preferido: null,
  configurado: false
});

const serializarFicha = (registro, userId, sportId, sport) => {
  if (!registro) {
    return {
      ...perfilPorDefecto(userId, sportId),
      sport
    };
  }

  return {
    ...registro.toJSON(),
    configurado: true,
    sport
  };
};

const construirSelectorDeportes = (todosLosDeportes, sportIdsActivos) =>
  todosLosDeportes.map((sport) => ({
    id: sport.id,
    name: sport.name,
    activo: sportIdsActivos.has(sport.id)
  }));

const parseSportId = (sportIdParam) => {
  const sportId = parseInt(sportIdParam, 10);
  if (Number.isNaN(sportId)) {
    return null;
  }
  return sportId;
};

const MANOS_HABIL_VALIDAS = ['DERECHA', 'IZQUIERDA', 'AMBIDIESTRO'];

const validarManoHabil = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const normalizado = String(valor).toUpperCase();
  return MANOS_HABIL_VALIDAS.includes(normalizado) ? normalizado : undefined;
};

/**
 * GET /api/perfil-deportivo/:sport_id
 */
export const getPerfilDeportivo = async (req, res) => {
  try {
    const sportId = parseSportId(req.params.sport_id);

    if (!sportId) {
      return res.status(400).json({
        success: false,
        message: 'sport_id inválido'
      });
    }

    const sport = await Sports.findByPk(sportId, { attributes: ['id', 'name'] });

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Deporte no encontrado'
      });
    }

    const registro = await UsuarioStatsPorSport.findOne({
      where: {
        user_id: req.userId,
        sport_id: sportId
      }
    });

    return res.status(200).json({
      success: true,
      data: serializarFicha(registro, req.userId, sportId, sport)
    });
  } catch (error) {
    console.error('Error en getPerfilDeportivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil deportivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/perfil-deportivo/:sport_id
 * Upsert de posicion_principal y pierna_habil únicamente.
 */
export const upsertPerfilDeportivo = async (req, res) => {
  try {
    const sportId = parseSportId(req.params.sport_id);

    if (!sportId) {
      return res.status(400).json({
        success: false,
        message: 'sport_id inválido'
      });
    }

    const sport = await Sports.findByPk(sportId, { attributes: ['id', 'name'] });

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Deporte no encontrado'
      });
    }

    const { posicion_principal, pierna_habil, mano_habil } = req.body;

    if (
      posicion_principal === undefined &&
      pierna_habil === undefined &&
      mano_habil === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar al menos posicion_principal, pierna_habil o mano_habil'
      });
    }

    const camposEditables = {};
    if (posicion_principal !== undefined) {
      camposEditables.posicion_principal = posicion_principal;
    }
    if (pierna_habil !== undefined) {
      camposEditables.pierna_habil = pierna_habil;
    }
    if (mano_habil !== undefined) {
      const mano = validarManoHabil(mano_habil);
      if (mano === undefined) {
        return res.status(400).json({
          success: false,
          message: "mano_habil debe ser 'DERECHA', 'IZQUIERDA' o 'AMBIDIESTRO'"
        });
      }
      camposEditables.mano_habil = mano;
    }

    let registro = await UsuarioStatsPorSport.findOne({
      where: {
        user_id: req.userId,
        sport_id: sportId
      }
    });

    if (registro) {
      await registro.update(camposEditables);
    } else {
      registro = await UsuarioStatsPorSport.create({
        user_id: req.userId,
        sport_id: sportId,
        ...camposEditables
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Perfil deportivo actualizado',
      data: serializarFicha(registro, req.userId, sportId, sport)
    });
  } catch (error) {
    console.error('Error en upsertPerfilDeportivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil deportivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/usuarios/mi-perfil-deportivo?sport_id=X
 */
export const getMiPerfilDeportivo = async (req, res) => {
  try {
    const sportId = parseSportId(req.query.sport_id);

    if (!sportId) {
      return res.status(400).json({
        success: false,
        message: 'sport_id inválido'
      });
    }

    const sport = await Sports.findByPk(sportId, { attributes: ['id', 'name'] });

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Deporte no encontrado'
      });
    }

    const [registro, todosLosDeportes, statsUsuario] = await Promise.all([
      UsuarioStatsPorSport.findOne({
        where: {
          user_id: req.userId,
          sport_id: sportId
        }
      }),
      Sports.findAll({
        attributes: ['id', 'name'],
        order: [['name', 'ASC']]
      }),
      UsuarioStatsPorSport.findAll({
        where: { user_id: req.userId },
        attributes: ['sport_id']
      })
    ]);

    const sportIdsActivos = new Set(statsUsuario.map((stat) => stat.sport_id));

    return res.status(200).json({
      success: true,
      data: {
        ficha: serializarFicha(registro, req.userId, sportId, sport),
        deportes: construirSelectorDeportes(todosLosDeportes, sportIdsActivos)
      }
    });
  } catch (error) {
    console.error('Error en getMiPerfilDeportivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil deportivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/usuarios/mi-perfil-deportivo
 * Upsert de posicion_principal, pierna_habil y dorsal_preferido.
 */
export const updateMiPerfilDeportivo = async (req, res) => {
  try {
    const sportId = parseSportId(req.body?.sport_id);

    if (!sportId) {
      return res.status(400).json({
        success: false,
        message: 'sport_id inválido'
      });
    }

    const sport = await Sports.findByPk(sportId, { attributes: ['id', 'name'] });

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Deporte no encontrado'
      });
    }

    const { posicion_principal, pierna_habil, mano_habil, dorsal_preferido } = req.body;

    if (
      posicion_principal === undefined &&
      pierna_habil === undefined &&
      mano_habil === undefined &&
      dorsal_preferido === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar al menos posicion_principal, pierna_habil, mano_habil o dorsal_preferido'
      });
    }

    const camposEditables = {};

    if (posicion_principal !== undefined) {
      camposEditables.posicion_principal = posicion_principal;
    }
    if (pierna_habil !== undefined) {
      camposEditables.pierna_habil = pierna_habil;
    }
    if (mano_habil !== undefined) {
      const mano = validarManoHabil(mano_habil);
      if (mano === undefined) {
        return res.status(400).json({
          success: false,
          message: "mano_habil debe ser 'DERECHA', 'IZQUIERDA' o 'AMBIDIESTRO'"
        });
      }
      camposEditables.mano_habil = mano;
    }
    if (dorsal_preferido !== undefined) {
      const dorsal = parseInt(dorsal_preferido, 10);
      if (Number.isNaN(dorsal) || dorsal < 0 || dorsal > 999) {
        return res.status(400).json({
          success: false,
          message: 'dorsal_preferido inválido'
        });
      }
      camposEditables.dorsal_preferido = dorsal;
    }

    let registro = await UsuarioStatsPorSport.findOne({
      where: {
        user_id: req.userId,
        sport_id: sportId
      }
    });

    if (registro) {
      await registro.update(camposEditables);
    } else {
      registro = await UsuarioStatsPorSport.create({
        user_id: req.userId,
        sport_id: sportId,
        ...camposEditables
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Perfil deportivo actualizado',
      data: serializarFicha(registro, req.userId, sportId, sport)
    });
  } catch (error) {
    console.error('Error en updateMiPerfilDeportivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil deportivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
