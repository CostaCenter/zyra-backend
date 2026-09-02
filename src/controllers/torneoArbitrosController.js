import { Op } from 'sequelize';

import { Torneos, TorneoArbitros, User } from '../db/db.js';

import {

  notificarInvitacionCuerpoArbitral,

  notificarRespuestaInvitacionCuerpoArbitral,

} from '../services/notificacionesService.js';

import {

  obtenerDetalleInvitacionCuerpoArbitral,

  responderInvitacionCuerpoArbitral,

} from '../services/invitacionCuerpoArbitralService.js';



const parseId = (value) => {

  const id = Number.parseInt(value, 10);

  return Number.isFinite(id) && id > 0 ? id : null;

};



const assertOrganizador = async (torneoId, userId) => {

  const torneo = await Torneos.findByPk(torneoId, {

    attributes: ['id', 'creado_por_user_id', 'nombre'],

  });

  if (!torneo) {

    return { error: { status: 404, message: 'Torneo no encontrado' } };

  }

  if (torneo.creado_por_user_id !== userId) {

    return { error: { status: 403, message: 'Solo el organizador del torneo puede realizar esta acción' } };

  }

  return { torneo };

};



const serializeArbitro = (row) => {

  const json = row.toJSON ? row.toJSON() : row;

  const usuario = json.usuario ?? {};

  return {

    id: json.id,

    torneo_id: json.torneo_id,

    usuario_id: json.usuario_id,

    estado_confirmacion: json.estado_confirmacion ?? 'PENDIENTE',

    creado_at: json.creado_at,

    usuario: {

      id: usuario.id,

      nick: usuario.nick,

      name: usuario.name,

      photo: usuario.photo,

    },

  };

};



/**

 * GET /api/torneos/:torneo_id/arbitros

 */

export const listArbitrosTorneo = async (req, res) => {

  try {

    const torneoId = parseId(req.params.torneo_id);

    if (!torneoId) {

      return res.status(400).json({ success: false, message: 'torneo_id inválido' });

    }



    const auth = await assertOrganizador(torneoId, req.userId);

    if (auth.error) {

      return res.status(auth.error.status).json({ success: false, message: auth.error.message });

    }



    const rows = await TorneoArbitros.findAll({

      where: { torneo_id: torneoId },

      include: [{

        model: User,

        as: 'usuario',

        attributes: ['id', 'nick', 'name', 'photo'],

      }],

      order: [['creado_at', 'ASC']],

    });



    return res.status(200).json({

      success: true,

      total: rows.length,

      data: rows.map(serializeArbitro),

    });

  } catch (error) {

    console.error('Error en listArbitrosTorneo:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al listar el cuerpo arbitral',

      error: process.env.NODE_ENV === 'development' ? error.message : undefined,

    });

  }

};



/**

 * POST /api/torneos/:torneo_id/arbitros

 * Body: { nick: string }

 */

export const addArbitroTorneo = async (req, res) => {

  try {

    const torneoId = parseId(req.params.torneo_id);

    if (!torneoId) {

      return res.status(400).json({ success: false, message: 'torneo_id inválido' });

    }



    const auth = await assertOrganizador(torneoId, req.userId);

    if (auth.error) {

      return res.status(auth.error.status).json({ success: false, message: auth.error.message });

    }



    const nick = String(req.body?.nick ?? '').trim();

    if (nick.length < 2) {

      return res.status(400).json({

        success: false,

        message: 'El nick es obligatorio (mínimo 2 caracteres)',

      });

    }



    const usuario = await User.findOne({

      where: {

        nick: { [Op.iLike]: nick },

      },

      attributes: ['id', 'nick', 'name', 'photo'],

    });



    if (!usuario) {

      return res.status(404).json({

        success: false,

        message: 'No se encontró un usuario con ese nick',

      });

    }



    if (usuario.id === req.userId) {

      return res.status(400).json({

        success: false,

        message: 'Ya eres el organizador de este torneo',

      });

    }



    const existente = await TorneoArbitros.findOne({

      where: { torneo_id: torneoId, usuario_id: usuario.id },

    });



    if (existente) {

      if (existente.estado_confirmacion === 'CONFIRMADO') {

        return res.status(409).json({

          success: false,

          message: 'Este árbitro ya está en el cuerpo arbitral del torneo',

        });

      }



      if (existente.estado_confirmacion === 'PENDIENTE') {

        return res.status(409).json({

          success: false,

          message: 'Ya hay una invitación pendiente para este árbitro',

        });

      }



      await existente.update({ estado_confirmacion: 'PENDIENTE' });



      const organizador = await User.findByPk(req.userId, {

        attributes: ['id', 'name', 'nick'],

      });



      await notificarInvitacionCuerpoArbitral({

        registroId: existente.id,

        arbitroId: usuario.id,

        torneo: auth.torneo,

        organizador,

      });



      const reinvitado = await TorneoArbitros.findByPk(existente.id, {

        include: [{

          model: User,

          as: 'usuario',

          attributes: ['id', 'nick', 'name', 'photo'],

        }],

      });



      return res.status(200).json({

        success: true,

        message: 'Invitación reenviada al árbitro',

        data: serializeArbitro(reinvitado),

      });

    }



    const row = await TorneoArbitros.create({

      torneo_id: torneoId,

      usuario_id: usuario.id,

      estado_confirmacion: 'PENDIENTE',

    });



    const organizador = await User.findByPk(req.userId, {

      attributes: ['id', 'name', 'nick'],

    });



    await notificarInvitacionCuerpoArbitral({

      registroId: row.id,

      arbitroId: usuario.id,

      torneo: auth.torneo,

      organizador,

    });



    const completo = await TorneoArbitros.findByPk(row.id, {

      include: [{

        model: User,

        as: 'usuario',

        attributes: ['id', 'nick', 'name', 'photo'],

      }],

    });



    return res.status(201).json({

      success: true,

      message: 'Invitación enviada al árbitro',

      data: serializeArbitro(completo),

    });

  } catch (error) {

    console.error('Error en addArbitroTorneo:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al invitar árbitro al torneo',

      error: process.env.NODE_ENV === 'development' ? error.message : undefined,

    });

  }

};



/**

 * GET /api/torneos/:torneo_id/arbitros/:registro_id/invitacion

 */

export const getInvitacionCuerpoArbitral = async (req, res) => {

  try {

    const torneoId = parseId(req.params.torneo_id);

    const registroId = parseId(req.params.registro_id);



    if (!torneoId || !registroId) {

      return res.status(400).json({

        success: false,

        message: 'torneo_id o registro_id inválido',

      });

    }



    const resultado = await obtenerDetalleInvitacionCuerpoArbitral(

      torneoId,

      registroId,

      req.userId

    );



    if (resultado.status !== 200) {

      return res.status(resultado.status).json({

        success: false,

        message: resultado.message,

      });

    }



    return res.status(200).json({

      success: true,

      data: resultado.data,

    });

  } catch (error) {

    console.error('Error en getInvitacionCuerpoArbitral:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al obtener invitación al cuerpo arbitral',

      error: process.env.NODE_ENV === 'development' ? error.message : undefined,

    });

  }

};



/**

 * PUT /api/torneos/:torneo_id/arbitros/:registro_id/responder

 */

export const responderInvitacionCuerpoArbitralController = async (req, res) => {

  try {

    const torneoId = parseId(req.params.torneo_id);

    const registroId = parseId(req.params.registro_id);

    const { respuesta } = req.body;



    if (!torneoId || !registroId) {

      return res.status(400).json({

        success: false,

        message: 'torneo_id o registro_id inválido',

      });

    }



    const resultado = await responderInvitacionCuerpoArbitral(

      torneoId,

      registroId,

      req.userId,

      respuesta

    );



    if (resultado.status !== 200) {

      return res.status(resultado.status).json({

        success: false,

        message: resultado.message,

      });

    }



    const { arbitro, torneo, organizador_id: organizadorId } = resultado.data;



    if (organizadorId) {

      await notificarRespuestaInvitacionCuerpoArbitral({

        organizadorId,

        arbitro,

        torneo,

        confirmado: respuesta === 'CONFIRMADO',

        registroId,

      });

    }



    return res.status(200).json({

      success: true,

      message: respuesta === 'CONFIRMADO'

        ? 'Te uniste al cuerpo arbitral'

        : 'Invitación rechazada',

      data: {

        registro_id: registroId,

        estado_confirmacion: resultado.data.estado_confirmacion,

      },

    });

  } catch (error) {

    console.error('Error en responderInvitacionCuerpoArbitralController:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al responder invitación al cuerpo arbitral',

      error: process.env.NODE_ENV === 'development' ? error.message : undefined,

    });

  }

};



/**

 * DELETE /api/torneos/:torneo_id/arbitros/:usuario_id

 */

export const removeArbitroTorneo = async (req, res) => {

  try {

    const torneoId = parseId(req.params.torneo_id);

    const usuarioId = parseId(req.params.usuario_id);

    if (!torneoId || !usuarioId) {

      return res.status(400).json({

        success: false,

        message: 'torneo_id o usuario_id inválido',

      });

    }



    const auth = await assertOrganizador(torneoId, req.userId);

    if (auth.error) {

      return res.status(auth.error.status).json({ success: false, message: auth.error.message });

    }



    const row = await TorneoArbitros.findOne({

      where: { torneo_id: torneoId, usuario_id: usuarioId },

    });



    if (!row) {

      return res.status(404).json({

        success: false,

        message: 'El árbitro no pertenece al cuerpo arbitral de este torneo',

      });

    }



    await row.destroy();



    return res.status(200).json({

      success: true,

      message: 'Árbitro eliminado del cuerpo arbitral',

    });

  } catch (error) {

    console.error('Error en removeArbitroTorneo:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al quitar árbitro del torneo',

      error: process.env.NODE_ENV === 'development' ? error.message : undefined,

    });

  }

};



/**

 * Verifica que un usuario pertenezca al cuerpo arbitral confirmado del torneo.

 */

export const usuarioEnCuerpoArbitral = async (torneoId, usuarioId) => {

  const row = await TorneoArbitros.findOne({

    where: {

      torneo_id: torneoId,

      usuario_id: usuarioId,

      estado_confirmacion: 'CONFIRMADO',

    },

    attributes: ['id'],

  });

  return Boolean(row);

};


