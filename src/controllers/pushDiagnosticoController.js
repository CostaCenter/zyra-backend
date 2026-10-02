import { Op } from 'sequelize';
import { User, DispositivosPush } from '../db/db.js';
import { enviarPushNotificacionUsuario } from '../services/pushNotificationService.js';
import { crearNotificacion } from '../services/notificacionesService.js';

function autorizado(req) {
  const key = req.headers['x-push-diag-key'];
  return key && key === process.env.JWT_SECRET;
}

export const diagnosticarPushUsuario = async (req, res) => {
  if (!autorizado(req)) {
    return res.status(403).json({ ok: false, message: 'No autorizado' });
  }

  try {
    const { nombre, usuario_id: usuarioIdRaw } = req.body ?? {};
    const enviar = req.body?.enviar !== false;

    let usuario = null;
    if (usuarioIdRaw) {
      usuario = await User.findByPk(Number(usuarioIdRaw), {
        attributes: ['id', 'name', 'nick', 'telefono', 'last_login'],
      });
    } else if (nombre) {
      usuario = await User.findOne({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: `%${nombre}%` } },
            { nick: { [Op.iLike]: `%${nombre}%` } },
          ],
        },
        attributes: ['id', 'name', 'nick', 'telefono', 'last_login'],
        order: [['id', 'DESC']],
      });
    } else {
      return res.status(400).json({ ok: false, message: 'Indica nombre o usuario_id' });
    }

    if (!usuario) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    const tokens = await DispositivosPush.findAll({
      where: { usuario_id: usuario.id },
      attributes: ['id', 'push_token', 'plataforma', 'created_at', 'updated_at'],
      order: [['updated_at', 'DESC NULLS LAST'], ['created_at', 'DESC']],
    });

    const resultado = {
      ok: true,
      usuario: {
        id: usuario.id,
        name: usuario.name,
        nick: usuario.nick,
        telefono: usuario.telefono,
        last_login: usuario.last_login,
      },
      tokens: tokens.map((t) => ({
        id: t.id,
        plataforma: t.plataforma,
        preview: `${t.push_token.slice(0, 28)}...`,
        updated_at: t.updated_at,
        created_at: t.created_at,
      })),
      push_enviado: false,
    };

    if (!tokens.length) {
      return res.status(200).json({
        ...resultado,
        ok: false,
        message: 'Sin token push. Reabre el APK, acepta notificaciones y vuelve a iniciar sesión.',
      });
    }

    if (!enviar) {
      return res.status(200).json(resultado);
    }

    const notificacion = await crearNotificacion({
      usuario_id: usuario.id,
      tipo: 'SISTEMA',
      categoria: 'general',
      mensaje: `🧪 **Prueba push APK** — ${new Date().toLocaleTimeString('es-CO')}`,
      referencia_tipo: 'TEST',
      referencia_id: null,
      metadata: { test: true, origen: 'push-diagnostico' },
    });

    await enviarPushNotificacionUsuario(
      usuario.id,
      { notificacion, navegacion: { destino: 'MainTabs', params: {} } },
      { verificarEntrega: true },
    );

    return res.status(200).json({
      ...resultado,
      push_enviado: true,
      notificacion_id: notificacion.id,
      message: 'Push enviado. Revisa el dispositivo en ~20s.',
    });
  } catch (error) {
    console.error('[PushDiag]', error);
    return res.status(500).json({ ok: false, message: error.message });
  }
};
