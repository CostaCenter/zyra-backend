import {
  registrarDispositivoPush,
  eliminarDispositivoPush,
} from '../services/dispositivosPushService.js';

export const registrarToken = async (req, res) => {
  try {
    const { push_token: pushToken, plataforma } = req.body ?? {};

    if (!pushToken || !plataforma) {
      return res.status(400).json({
        success: false,
        message: 'push_token y plataforma son requeridos',
      });
    }

    const dispositivo = await registrarDispositivoPush(
      req.userId,
      pushToken,
      plataforma,
    );

    console.log(`[Push] Token registrado usuario=${req.userId} plataforma=${plataforma}`);

    return res.status(200).json({
      success: true,
      data: {
        id: dispositivo.id,
        push_token: dispositivo.push_token,
        plataforma: dispositivo.plataforma,
      },
    });
  } catch (error) {
    console.error('Error en registrarToken push:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'No se pudo registrar el dispositivo',
    });
  }
};

export const eliminarToken = async (req, res) => {
  try {
    const { push_token: pushToken } = req.body ?? {};

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'push_token es requerido',
      });
    }

    const resultado = await eliminarDispositivoPush(req.userId, pushToken);

    if (!resultado) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo no encontrado',
      });
    }

    return res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    console.error('Error en eliminarToken push:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo eliminar el dispositivo',
    });
  }
};
