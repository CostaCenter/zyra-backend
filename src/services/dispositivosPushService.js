import { Op } from 'sequelize';
import { DispositivosPush } from '../db/db.js';

const PLATAFORMAS_VALIDAS = new Set(['ios', 'android']);

/** Un token activo por plataforma evita pushes duplicados tras reinstalar/rebuild. */
async function invalidarTokensAnterioresMismaPlataforma(usuarioId, plataforma, tokenActivo) {
  const eliminados = await DispositivosPush.destroy({
    where: {
      usuario_id: usuarioId,
      plataforma,
      push_token: { [Op.ne]: tokenActivo },
    },
  });

  if (eliminados > 0) {
    console.log(
      `[Push] Usuario ${usuarioId} (${plataforma}): ${eliminados} token(s) anterior(es) invalidado(s)`
    );
  }
}

export function normalizarPlataforma(plataforma) {
  const value = String(plataforma ?? '').trim().toLowerCase();
  if (!PLATAFORMAS_VALIDAS.has(value)) {
    throw new Error('Plataforma inválida. Use ios o android.');
  }
  return value;
}

export async function registrarDispositivoPush(usuarioId, pushToken, plataforma) {
  const token = String(pushToken ?? '').trim();
  if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
    throw new Error('Token push inválido');
  }

  const plataformaNorm = normalizarPlataforma(plataforma);

  await invalidarTokensAnterioresMismaPlataforma(usuarioId, plataformaNorm, token);

  const existente = await DispositivosPush.findOne({ where: { push_token: token } });

  if (existente) {
    await existente.update({
      usuario_id: usuarioId,
      plataforma: plataformaNorm,
    });
    return existente;
  }

  return DispositivosPush.create({
    usuario_id: usuarioId,
    push_token: token,
    plataforma: plataformaNorm,
  });
}

export async function eliminarDispositivoPush(usuarioId, pushToken) {
  const token = String(pushToken ?? '').trim();
  if (!token) return null;

  const row = await DispositivosPush.findOne({
    where: { usuario_id: usuarioId, push_token: token },
  });

  if (!row) return null;

  await row.destroy();
  return { id: row.id };
}

export async function listarTokensUsuario(usuarioId) {
  const rows = await DispositivosPush.findAll({
    where: { usuario_id: usuarioId },
    attributes: ['push_token'],
  });
  return rows.map((row) => row.push_token);
}
