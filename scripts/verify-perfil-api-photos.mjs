/**
 * Verifica qué devuelve el endpoint de perfil para Andrés y Kevin.
 * Uso: node scripts/verify-perfil-api-photos.mjs
 */
import sequelize from '../src/config/database.js';
import { User, Sports } from '../src/db/db.js';
import { obtenerContadoresUsuario, obtenerDeportesUsuario } from '../src/services/publicacionesService.js';

const USER_IDS = [1, 14];

try {
  for (const userId of USER_IDS) {
    const usuario = await User.findByPk(userId, {
      attributes: ['id', 'name', 'nick', 'photo', 'foto_portada_url', 'bio', 'deporte_principal_id', 'role'],
      include: [{
        model: Sports,
        as: 'deportePrincipal',
        attributes: ['id', 'name'],
        required: false,
      }],
    });

    if (!usuario) {
      console.log(`userId=${userId}: NO ENCONTRADO`);
      continue;
    }

    const deportes = await obtenerDeportesUsuario(userId);
    const contadores = await obtenerContadoresUsuario(userId);

    console.log('\n--- API shape (usuario) ---');
    console.log(JSON.stringify({
      userId,
      usuario: {
        id: usuario.id,
        name: usuario.name,
        nick: usuario.nick,
        photo: usuario.photo,
        foto_portada_url: usuario.foto_portada_url,
      },
      contadores,
      deportes_activos: deportes.filter((d) => d.activo).length,
    }, null, 2));
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
