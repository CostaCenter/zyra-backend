/**
 * Seed de mensualidades + inscripción para Andrés Orrego en Zyra Club.
 * Ejecutar: node scripts/seed-andres-pagos.mjs
 */
import sequelize from '../src/config/database.js';

const CLUB_ID = 2;
const USUARIO_ID = 1;
const ADMIN_ID = 14;

const MENSUALIDADES_SEED = [
  {
    fecha_corte: '2026-07-15',
    estado: 'PAGADO',
    fecha_pago_real: '2026-07-16T14:30:00.000Z',
  },
  {
    fecha_corte: '2026-08-15',
    estado: 'PAGADO',
    fecha_pago_real: '2026-08-14T10:15:00.000Z',
  },
  {
    fecha_corte: '2026-09-15',
    estado: 'PAGADO',
    fecha_pago_real: '2026-09-16T09:00:00.000Z',
  },
];

const INSCRIPCION_SEED = {
  fecha_corte: '2026-06-10',
  estado: 'PAGADO',
  fecha_pago_real: '2026-06-10T16:00:00.000Z',
};

async function ensureConcepto(clubId, tipo, defaults, transaction) {
  let [rows] = await sequelize.query(
    `SELECT id, monto FROM club_conceptos_pago
     WHERE club_id = :clubId AND tipo = :tipo AND activo = true
     ORDER BY id LIMIT 1`,
    { replacements: { clubId, tipo }, transaction },
  );

  if (!rows.length) {
    [rows] = await sequelize.query(
      `INSERT INTO club_conceptos_pago
         (club_id, tipo, nombre_personalizado, monto, dias_aviso_previo, activo)
       VALUES
         (:clubId, :tipo, :nombre, :monto, :diasAviso, true)
       RETURNING id, monto`,
      {
        replacements: {
          clubId,
          tipo,
          nombre: defaults.nombre,
          monto: defaults.monto,
          diasAviso: defaults.diasAviso ?? 5,
        },
        transaction,
      },
    );
    console.log(`Concepto ${tipo} creado`);
  }

  return rows[0];
}

async function upsertPago({
  conceptoId,
  usuarioId,
  pago,
  adminId,
  transaction,
  cuotaIngreso = false,
}) {
  if (cuotaIngreso) {
    const [updated] = await sequelize.query(
      `UPDATE club_pagos_miembro
       SET estado = :estado,
           fecha_pago_real = :fechaPago,
           registrado_por_id = :adminId
       WHERE concepto_pago_id = :conceptoId
         AND usuario_id = :usuarioId
       RETURNING id`,
      {
        replacements: {
          conceptoId,
          usuarioId,
          fechaPago: pago.fecha_pago_real,
          estado: pago.estado,
          adminId,
        },
        transaction,
      },
    );
    if (updated.length) return;

    await sequelize.query(
      `INSERT INTO club_pagos_miembro
         (concepto_pago_id, usuario_id, fecha_corte, fecha_pago_real, estado, registrado_por_id, creado_at)
       VALUES
         (:conceptoId, :usuarioId, :fechaCorte, :fechaPago, :estado, :adminId, NOW())`,
      {
        replacements: {
          conceptoId,
          usuarioId,
          fechaCorte: pago.fecha_corte,
          fechaPago: pago.fecha_pago_real,
          estado: pago.estado,
          adminId,
        },
        transaction,
      },
    );
    return;
  }

  await sequelize.query(
    `DELETE FROM club_pagos_miembro
     WHERE concepto_pago_id = :conceptoId
       AND usuario_id = :usuarioId
       AND fecha_corte = :fechaCorte`,
    {
      replacements: {
        conceptoId,
        usuarioId,
        fechaCorte: pago.fecha_corte,
      },
      transaction,
    },
  );

  await sequelize.query(
    `INSERT INTO club_pagos_miembro
       (concepto_pago_id, usuario_id, fecha_corte, fecha_pago_real, estado, registrado_por_id, creado_at)
     VALUES
       (:conceptoId, :usuarioId, :fechaCorte, :fechaPago, :estado, :adminId, NOW())`,
    {
      replacements: {
        conceptoId,
        usuarioId,
        fechaCorte: pago.fecha_corte,
        fechaPago: pago.fecha_pago_real,
        estado: pago.estado,
        adminId,
      },
      transaction,
    },
  );
}

async function main() {
  const [userRows] = await sequelize.query(
    `SELECT id, name FROM "user" WHERE id = :usuarioId`,
    { replacements: { usuarioId: USUARIO_ID } },
  );
  const user = userRows[0];
  if (!user) throw new Error(`Usuario ${USUARIO_ID} no encontrado`);

  await sequelize.transaction(async (transaction) => {
    const conceptoMensualidad = await ensureConcepto(
      CLUB_ID,
      'MENSUALIDAD',
      { nombre: 'Mensualidad Juvenil', monto: 120000 },
      transaction,
    );

    const conceptoInscripcion = await ensureConcepto(
      CLUB_ID,
      'CUOTA_INGRESO',
      { nombre: 'Inscripción Juvenil', monto: 80000 },
      transaction,
    );

    for (const pago of MENSUALIDADES_SEED) {
      await upsertPago({
        conceptoId: conceptoMensualidad.id,
        usuarioId: USUARIO_ID,
        pago,
        adminId: ADMIN_ID,
        transaction,
      });
    }

    await upsertPago({
      conceptoId: conceptoInscripcion.id,
      usuarioId: USUARIO_ID,
      pago: INSCRIPCION_SEED,
      adminId: ADMIN_ID,
      transaction,
      cuotaIngreso: true,
    });

    console.log(`✅ Pagos seed para ${user.name} (usuario #${USUARIO_ID})`);
    console.log(`   Mensualidad #${conceptoMensualidad.id}`);
    MENSUALIDADES_SEED.forEach((p) => {
      console.log(`   · ${p.fecha_corte} → ${p.estado}`);
    });
    console.log(`   Inscripción #${conceptoInscripcion.id}`);
    console.log(`   · ${INSCRIPCION_SEED.fecha_corte} → ${INSCRIPCION_SEED.estado}`);
  });
}

main()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
