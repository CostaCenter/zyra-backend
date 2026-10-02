import { Op } from 'sequelize';
import { User, UserActivityEvents } from '../db/db.js';
import { USER_ACTIVITY_EVENT_TYPES, LAST_ACTIVE_DEBOUNCE_MS } from '../constants/userActivityEvents.js';
import { scheduleSideEffect } from '../utils/scheduleSideEffect.js';

const testUserCache = new Map();

async function usuarioEsDatoPrueba(usuarioId) {
  const id = Number(usuarioId);
  if (!id) return true;
  if (testUserCache.has(id)) return testUserCache.get(id);
  const row = await User.findByPk(id, { attributes: ['id', 'es_dato_prueba'] });
  const flag = Boolean(row?.es_dato_prueba);
  testUserCache.set(id, flag);
  return flag;
}

/**
 * Actualiza last_active_at como máximo cada 10 minutos (condición en SQL, multi-instancia).
 */
export async function touchLastActiveIfDue(userId) {
  const id = Number(userId);
  if (!id) return;

  const threshold = new Date(Date.now() - LAST_ACTIVE_DEBOUNCE_MS);
  try {
    await User.update(
      { last_active_at: new Date() },
      {
        where: {
          id,
          es_dato_prueba: false,
          [Op.or]: [
            { last_active_at: null },
            { last_active_at: { [Op.lt]: threshold } },
          ],
        },
      },
    );
  } catch (err) {
    console.warn('[userActivity] touchLastActiveIfDue:', err?.message);
  }
}

export function scheduleTouchLastActive(userId) {
  scheduleSideEffect('touch-last-active', () => touchLastActiveIfDue(userId));
}

export async function recordUserActivity({
  usuarioId,
  tipo,
  entidadTipo = null,
  entidadId = null,
  occurredAt = null,
}) {
  const uid = Number(usuarioId);
  if (!uid) return;

  const tipoNorm = String(tipo ?? '').trim().toUpperCase();
  if (!USER_ACTIVITY_EVENT_TYPES.includes(tipoNorm)) {
    console.warn('[userActivity] tipo ignorado:', tipo);
    return;
  }

  if (await usuarioEsDatoPrueba(uid)) return;

  try {
    await UserActivityEvents.create({
      usuario_id: uid,
      tipo: tipoNorm,
      entidad_tipo: entidadTipo ? String(entidadTipo).trim().toUpperCase() : null,
      entidad_id: entidadId != null ? Number(entidadId) : null,
      occurred_at: occurredAt ? new Date(occurredAt) : new Date(),
    });
  } catch (err) {
    console.warn('[userActivity] recordUserActivity:', err?.message);
  }
}

export function scheduleRecordUserActivity(payload) {
  scheduleSideEffect('record-user-activity', () => recordUserActivity(payload));
}
