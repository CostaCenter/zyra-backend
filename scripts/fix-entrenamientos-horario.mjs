/**
 * Ajusta entrenamientos de prueba a 6:00 p.m. – 8:00 p.m. (hora local del servidor).
 * Ejecutar: node scripts/fix-entrenamientos-horario.mjs
 */
import sequelize from '../src/config/database.js';

const [rows] = await sequelize.query(`
  SELECT id, fecha_hora, fecha_hora_fin
  FROM club_eventos
  WHERE tipo = 'ENTRENAMIENTO'
  ORDER BY fecha_hora DESC
`);

for (const row of rows) {
  const inicio = new Date(row.fecha_hora);
  const finBase = row.fecha_hora_fin ? new Date(row.fecha_hora_fin) : new Date(inicio);

  const nuevoInicio = new Date(inicio);
  nuevoInicio.setHours(18, 0, 0, 0);

  const nuevoFin = new Date(finBase);
  nuevoFin.setFullYear(nuevoInicio.getFullYear(), nuevoInicio.getMonth(), nuevoInicio.getDate());
  nuevoFin.setHours(20, 0, 0, 0);

  await sequelize.query(
    `UPDATE club_eventos SET fecha_hora = :inicio, fecha_hora_fin = :fin WHERE id = :id`,
    {
      replacements: {
        id: row.id,
        inicio: nuevoInicio.toISOString(),
        fin: nuevoFin.toISOString(),
      },
    },
  );

  console.log(`Evento ${row.id}: ${nuevoInicio.toLocaleString('es-CO')} – ${nuevoFin.toLocaleString('es-CO')}`);
}

console.log(`Actualizados ${rows.length} entrenamientos.`);
await sequelize.close();
