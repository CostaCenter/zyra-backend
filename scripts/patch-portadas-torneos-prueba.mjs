/**
 * Asigna portadas de Unsplash (por deporte) a torneos SEED_/TEST_/es_dato_prueba.
 */
import { Op } from 'sequelize';
import sequelize from '../src/config/database.js';
import { Torneos, Sports } from '../src/db/db.js';
import { urlPortadaPorDeporte } from '../src/utils/portadasDeporte.js';

try {
  const torneos = await Torneos.findAll({
    where: {
      [Op.or]: [
        { es_dato_prueba: true },
        { nombre: { [Op.iLike]: 'SEED_%' } },
        { nombre: { [Op.iLike]: 'TEST_%' } },
      ],
    },
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
  });

  for (const torneo of torneos) {
    const url = urlPortadaPorDeporte(torneo.sport?.name, torneo.nombre || torneo.id);
    await torneo.update({
      imagen_portada_url: url,
      photo: url,
    });
    console.log(`#${torneo.id} ${torneo.nombre} → ${torneo.sport?.name} → ${url}`);
  }

  console.log(`\nActualizados ${torneos.length} torneos de prueba.`);
} finally {
  await sequelize.close();
}
