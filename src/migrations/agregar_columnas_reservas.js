/**
 * Migración: Agregar columnas de movimiento y cancelación a la tabla reservas.
 * Ejecutar UNA sola vez con: node src/migrations/agregar_columnas_reservas.js
 */

import sequelize from '../config/database.js';

const migrar = async () => {
  const qi = sequelize.getQueryInterface();

  console.log('Iniciando migración de tabla reservas...\n');

  // Lista de columnas a agregar: [nombre, tipo SQL]
  const columnas = [
    ['fecha_original',        'DATE'],
    ['hora_inicio_original',  'TIME'],
    ['motivo_movimiento',     'TEXT'],
    ['movida_por_id',         'INTEGER'],
    ['movida_at',             'TIMESTAMP WITH TIME ZONE'],
    ['cancelada_por_id',      'INTEGER'],
    ['cancelada_at',          'TIMESTAMP WITH TIME ZONE'],
  ];

  for (const [nombre, tipo] of columnas) {
    try {
      await sequelize.query(
        `ALTER TABLE reservas ADD COLUMN IF NOT EXISTS "${nombre}" ${tipo};`
      );
      console.log(`  ✅ Columna agregada: ${nombre} (${tipo})`);
    } catch (err) {
      console.error(`  ❌ Error en columna ${nombre}:`, err.message);
    }
  }

  // También ajustar defaults del estado_pago y estado_reserva si es necesario
  try {
    await sequelize.query(`ALTER TABLE reservas ALTER COLUMN estado_pago SET DEFAULT 'ABONADA';`);
    await sequelize.query(`ALTER TABLE reservas ALTER COLUMN estado_reserva SET DEFAULT 'CONFIRMADA';`);
    console.log('  ✅ Defaults de estado_pago y estado_reserva actualizados');
  } catch (err) {
    console.error('  ❌ Error actualizando defaults:', err.message);
  }

  console.log('\nMigración completada.');
  await sequelize.close();
  process.exit(0);
};

migrar().catch(err => {
  console.error('Error fatal en migración:', err);
  process.exit(1);
});
