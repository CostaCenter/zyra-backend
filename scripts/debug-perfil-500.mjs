import sequelize from '../src/config/database.js';
import { listarPublicacionesFiltradas, listarPublicacionesDondeEtiquetado } from '../src/services/publicacionesService.js';
import { PublicacionEtiquetas, Publicaciones, User } from '../src/db/db.js';

try {
  const [cols] = await sequelize.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'publicaciones'
    AND column_name IN ('publicado_como', 'equipo_id')
    ORDER BY column_name
  `);
  console.log('Columnas publicaciones:', cols);

  const [userCols] = await sequelize.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'user'
    AND column_name = 'foto_portada_url'
  `);
  console.log('Columna foto_portada_url:', userCols);

  await listarPublicacionesFiltradas(1, 1);
  console.log('OK listarPublicacionesFiltradas');

  await listarPublicacionesDondeEtiquetado(1, 1);
  console.log('OK listarPublicacionesDondeEtiquetado');

  await PublicacionEtiquetas.findAll({
    where: { user_id_etiquetado: 1, confirmado: false },
    include: [{
      model: Publicaciones,
      as: 'publicacion',
      include: [{ model: User, as: 'autor', attributes: ['id', 'nick', 'name', 'photo'] }],
    }],
    limit: 1,
  });
  console.log('OK etiquetas pendientes query');
} catch (error) {
  console.error('FAIL:', error.message);
  if (error.parent?.detail) console.error('detail:', error.parent.detail);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
