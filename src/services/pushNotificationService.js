import { DispositivosPush } from '../db/db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export function mensajePushPlano(mensaje) {
  return String(mensaje ?? '').replace(/\*\*/g, '').trim();
}

async function enviarLote(messages) {
  if (!messages.length) return [];

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    console.error('Expo push API error:', response.status, await response.text());
    return [];
  }

  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function limpiarTokensInvalidos(messages, tickets) {
  const tareas = tickets.map(async (ticket, index) => {
    if (ticket?.status !== 'error') return;
    const errorCode = ticket?.details?.error;
    if (errorCode !== 'DeviceNotRegistered' && errorCode !== 'InvalidCredentials') return;

    const token = messages[index]?.to;
    if (!token) return;

    await DispositivosPush.destroy({ where: { push_token: token } });
  });

  await Promise.all(tareas);
}

export async function enviarPushNotificacionUsuario(usuarioId, { notificacion, navegacion }) {
  try {
    const dispositivos = await DispositivosPush.findAll({
      where: { usuario_id: usuarioId },
      attributes: ['push_token'],
    });

    if (!dispositivos.length) {
      console.warn(`[Push] Usuario ${usuarioId} sin tokens registrados — push omitido`);
      return;
    }

    const body = mensajePushPlano(notificacion?.mensaje);
    if (!body) {
      console.warn(`[Push] Notificación ${notificacion?.id} sin mensaje — push omitido`);
      return;
    }

    const data = {
      notificacionId: String(notificacion.id ?? ''),
      tipo: notificacion.tipo ?? '',
      referencia_id: notificacion.referencia_id != null ? String(notificacion.referencia_id) : '',
      referencia_tipo: notificacion.referencia_tipo ?? '',
      destino: navegacion?.destino ?? '',
      params: JSON.stringify(navegacion?.params ?? {}),
    };

    const notifId = notificacion.id != null ? String(notificacion.id) : null;
    const dedupeTag = notifId ? `zyra-notif-${notifId}` : undefined;

    const messages = dispositivos.map((row) => ({
      to: row.push_token,
      sound: 'default',
      title: 'Zyra',
      body,
      data,
      channelId: 'default',
      ...(dedupeTag ? { tag: dedupeTag, collapseId: dedupeTag } : {}),
    }));

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const chunk = messages.slice(i, i + BATCH_SIZE);
      const tickets = await enviarLote(chunk);
      console.log(`[Push] Enviado a ${chunk.length} dispositivo(s) del usuario ${usuarioId}`, tickets);
      await limpiarTokensInvalidos(chunk, tickets);
    }
  } catch (error) {
    console.error('Error enviando push notification:', error);
  }
}
