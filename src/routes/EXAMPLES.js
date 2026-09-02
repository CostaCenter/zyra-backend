/**
 * EJEMPLOS DE USO - Sistema de Autenticación Zyra
 * 
 * Estos son ejemplos de cómo usar el sistema de autenticación
 * en diferentes rutas de tu aplicación
 */

import express from 'express';
import { verifyToken, verifyRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ============================================
// EJEMPLO 1: Ruta pública (sin protección)
// ============================================
router.get('/complejos', async (req, res) => {
  try {
    // Cualquier usuario puede ver los complejos
    // const complejos = await Complejos.findAll();
    res.json({
      success: true,
      message: 'Lista de complejos públicos',
      data: [] // complejos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener complejos'
    });
  }
});

// ============================================
// EJEMPLO 2: Ruta protegida (requiere autenticación)
// ============================================
router.post('/reservas', verifyToken, async (req, res) => {
  try {
    // Solo usuarios autenticados pueden hacer reservas
    const userId = req.userId; // ID del usuario autenticado
    const userData = req.user; // Datos completos del usuario
    
    const { cancha_id, fecha, hora_inicio, hora_fin } = req.body;

    // Crear la reserva asociada al usuario autenticado
    // const reserva = await Reservas.create({
    //   user_id: userId,
    //   cancha_id,
    //   fecha,
    //   hora_inicio,
    //   hora_fin
    // });

    res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente',
      data: {
        // reserva,
        creada_por: userData.username
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear reserva'
    });
  }
});

// ============================================
// EJEMPLO 3: Ruta protegida con verificación de rol
// ============================================
router.post('/complejos', 
  verifyToken, 
  verifyRole(['admin', 'owner']), 
  async (req, res) => {
    try {
      // Solo usuarios con rol 'admin' u 'owner' pueden crear complejos
      const userId = req.userId;
      const { nombre, direccion, ciudad } = req.body;

      // Crear el complejo
      // const complejo = await Complejos.create({
      //   nombre,
      //   direccion,
      //   ciudad,
      //   dueño_id: userId
      // });

      res.status(201).json({
        success: true,
        message: 'Complejo creado exitosamente',
        data: {} // complejo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al crear complejo'
      });
    }
});

// ============================================
// EJEMPLO 4: Ruta para editar perfil propio
// ============================================
router.put('/perfil', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { nombre, apellido, telefono } = req.body;

    // Actualizar datos del usuario autenticado
    // await User.update(
    //   { nombre, apellido, telefono },
    //   { where: { id: userId } }
    // );

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
});

// ============================================
// EJEMPLO 5: Ruta para ver reservas propias
// ============================================
router.get('/mis-reservas', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Obtener solo las reservas del usuario autenticado
    // const reservas = await Reservas.findAll({
    //   where: { user_id: userId },
    //   include: [
    //     { model: Canchas, as: 'cancha' }
    //   ]
    // });

    res.json({
      success: true,
      message: 'Reservas del usuario',
      data: [] // reservas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener reservas'
    });
  }
});

// ============================================
// EJEMPLO 6: Ruta admin - Ver todas las reservas
// ============================================
router.get('/admin/reservas', 
  verifyToken, 
  verifyRole(['admin']), 
  async (req, res) => {
    try {
      // Solo admins pueden ver todas las reservas
      // const reservas = await Reservas.findAll({
      //   include: [
      //     { model: User, as: 'usuario' },
      //     { model: Canchas, as: 'cancha' }
      //   ]
      // });

      res.json({
        success: true,
        message: 'Todas las reservas (admin)',
        data: [] // reservas
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener reservas'
      });
    }
});

// ============================================
// EJEMPLO 7: Verificar si el recurso pertenece al usuario
// ============================================
router.delete('/reservas/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const reservaId = req.params.id;

    // Buscar la reserva
    // const reserva = await Reservas.findByPk(reservaId);

    // if (!reserva) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Reserva no encontrada'
    //   });
    // }

    // Verificar que la reserva pertenezca al usuario
    // if (reserva.user_id !== userId) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'No tienes permiso para eliminar esta reserva'
    //   });
    // }

    // Eliminar la reserva
    // await reserva.destroy();

    res.json({
      success: true,
      message: 'Reserva eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar reserva'
    });
  }
});

// ============================================
// EJEMPLO 8: Ruta con autenticación opcional
// ============================================
router.get('/canchas', async (req, res) => {
  try {
    // Verificar si hay token (pero no es obligatorio)
    const authHeader = req.headers.authorization;
    let usuario = null;

    if (authHeader) {
      try {
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.slice(7) 
          : authHeader;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        usuario = decoded;
      } catch (error) {
        // Si el token es inválido, simplemente lo ignoramos
        // No lanzamos error porque la autenticación es opcional
      }
    }

    // Obtener canchas
    // const canchas = await Canchas.findAll();

    res.json({
      success: true,
      message: usuario 
        ? `Canchas para ${usuario.username}` 
        : 'Canchas (usuario invitado)',
      data: [] // canchas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener canchas'
    });
  }
});

// ============================================
// EJEMPLO 9: Crear equipo (solo usuarios autenticados)
// ============================================
router.post('/equipos', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { nombre, sport_id, descripcion } = req.body;

    // Crear equipo con el usuario actual como capitán
    // const equipo = await Team.create({
    //   nombre,
    //   sport_id,
    //   descripcion,
    //   capitan_id: userId
    // });

    res.status(201).json({
      success: true,
      message: 'Equipo creado exitosamente',
      data: {} // equipo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear equipo'
    });
  }
});

// ============================================
// EJEMPLO 10: Middleware personalizado combinado
// ============================================
const esCapitanDelEquipo = async (req, res, next) => {
  try {
    const userId = req.userId; // Ya viene del verifyToken
    const teamId = req.params.teamId;

    // const equipo = await Team.findByPk(teamId);

    // if (!equipo) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Equipo no encontrado'
    //   });
    // }

    // if (equipo.capitan_id !== userId) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Solo el capitán puede modificar el equipo'
    //   });
    // }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos'
    });
  }
};

router.put('/equipos/:teamId', 
  verifyToken, 
  esCapitanDelEquipo, 
  async (req, res) => {
    try {
      const teamId = req.params.teamId;
      const { nombre, descripcion } = req.body;

      // Actualizar equipo
      // await Team.update(
      //   { nombre, descripcion },
      //   { where: { id: teamId } }
      // );

      res.json({
        success: true,
        message: 'Equipo actualizado exitosamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al actualizar equipo'
      });
    }
});

export default router;
