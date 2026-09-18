import { DispositivosPush } from '../db/db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const BATCH_SIZE = 100;
const EXPO_PUSH_TIMEOUT_MS = 8000;
const RECEIPT_CHECK_DELAY_MS = 15000; // 15 segundos de espera antes de consultar receipts

export function mensajePushPlano(mensaje) {
  return String(mensaje ?? '').replace(/\*\*/g, '').trim();
}

async function enviarLote(messages) {
  if (!messages.length) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPO_PUSH_TIMEOUT_MS);

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Expo push API error:', response.status, await response.text());
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.error(`Expo push API timeout (>${EXPO_PUSH_TIMEOUT_MS}ms)`);
    } else {
      console.error('Expo push API fetch error:', error);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function consultarReceipts(ticketIds) {
  if (!ticketIds.length) return {};

  try {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });

    if (!response.ok) {
      console.error('Expo receipts API error:', response.status, await response.text());
      return {};
    }

    const payload = await response.json();
    return payload?.data ?? {};
  } catch (error) {
    console.error('Expo receipts API fetch error:', error);
    return {};
  }
}

async function limpiarTokensInvalidos(messages, tickets) {
  const tareas = tickets.map(async (ticket, index) => {
    if (ticket?.status !== 'error') return;
    const errorCode = ticket?.details?.error;
    if (errorCode !== 'DeviceNotRegistered' && errorCode !== 'InvalidCredentials') return;

    const token = messages[index]?.to;
    if (!token) return;

    await DispositivosPush.destroy({ where: { push_token: token } });
    console.log(`[Push] Token inválido eliminado: ${token.substring(0, 30)}... (error: ${errorCode})`);
  });

  await Promise.all(tareas);
}

async function limpiarTokensInvalidosPorReceipts(tokensConTickets, receipts) {
  const tareas = tokensConTickets.map(async ({ token, ticketId }) => {
    const receipt = receipts[ticketId];
    if (!receipt || receipt.status !== 'error') return;

    const errorCode = receipt?.details?.error;
    if (errorCode !== 'DeviceNotRegistered' && errorCode !== 'InvalidCredentials') return;

    await DispositivosPush.destroy({ where: { push_token: token } });
    console.log(`[Push] Token inválido eliminado por receipt: ${token.substring(0, 30)}... (error: ${errorCode})`);
  });

  await Promise.all(tareas);
}

/**
 * Verifica los receipts reales de los tickets enviados.
 * Esta es la verificación DEFINITIVA de entrega, no el ticket inicial.
 * 
 * @param {Array} tokensConTickets - Array de objetos { token, ticketId }
 * @returns {Promise<Object>} - { exitosos, fallidos, pendientes }
 */
async function verificarReceipts(tokensConTickets) {
  if (!tokensConTickets.length) {
    return { exitosos: 0, fallidos: 0, pendientes: 0 };
  }

  const ticketIds = tokensConTickets
    .map((item) => item.ticketId)
    .filter(Boolean);

  if (!ticketIds.length) {
    console.warn('[Push] No hay tickets válidos para verificar receipts');
    return { exitosos: 0, fallidos: 0, pendientes: ticketIds.length };
  }

  console.log(`[Push] ⏳ Esperando ${RECEIPT_CHECK_DELAY_MS / 1000}s antes de verificar receipts...`);
  await new Promise((resolve) => setTimeout(resolve, RECEIPT_CHECK_DELAY_MS));

  console.log(`[Push] 🔍 Consultando receipts para ${ticketIds.length} ticket(s)...`);
  const receipts = await consultarReceipts(ticketIds);

  let exitosos = 0;
  let fallidos = 0;
  let pendientes = 0;

  tokensConTickets.forEach(({ token, ticketId }) => {
    const receipt = receipts[ticketId];
    
    if (!receipt) {
      pendientes++;
      console.warn(`[Push] ⚠️  Receipt pendiente para ticket ${ticketId}`);
      return;
    }

    if (receipt.status === 'ok') {
      exitosos++;
      console.log(`[Push] ✅ Entrega confirmada para ${token.substring(0, 30)}...`);
    } else {
      fallidos++;
      console.error(
        `[Push] ❌ Entrega fallida para ${token.substring(0, 30)}...`,
        `Error: ${receipt.details?.error || receipt.message}`,
      );
    }
  });

  // Limpiar tokens que fallaron por receipts
  await limpiarTokensInvalidosPorReceipts(tokensConTickets, receipts);

  return { exitosos, fallidos, pendientes };
}

export async function enviarPushNotificacionUsuario(
  usuarioId,
  { notificacion, navegacion },
  { verificarEntrega = true } = {},
) {
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

    const tokensConTickets = [];

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const chunk = messages.slice(i, i + BATCH_SIZE);
      const tickets = await enviarLote(chunk);

      console.log(
        `[Push] 📤 Enviado a ${chunk.length} dispositivo(s) del usuario ${usuarioId}`,
        tickets.map((t) => ({ status: t?.status, id: t?.id?.substring(0, 20) })),
      );

      // Limpiar tokens inválidos detectados en el ticket inicial
      await limpiarTokensInvalidos(chunk, tickets);

      // Recopilar tickets exitosos para verificación posterior
      tickets.forEach((ticket, index) => {
        if (ticket?.status === 'ok' && ticket?.id) {
          tokensConTickets.push({
            token: chunk[index].to,
            ticketId: ticket.id,
          });
        }
      });
    }

    // Verificar receipts reales si está habilitado
    if (verificarEntrega && tokensConTickets.length > 0) {
      const resultado = await verificarReceipts(tokensConTickets);
      console.log(
        `[Push] 📊 Resultado final para usuario ${usuarioId}:`,
        `✅ ${resultado.exitosos} entregados`,
        `❌ ${resultado.fallidos} fallidos`,
        `⏳ ${resultado.pendientes} pendientes`,
      );
    } else {
      console.log(`[Push] ⚠️  Verificación de receipts deshabilitada (modo legacy)`);
    }
  } catch (error) {
    console.error('Error enviando push notification:', error);
  }
}
