import sequelize from '../src/config/database.js';
import { DispositivosPush } from '../src/db/db.js';
import { crearNotificacion, TIPOS_NOTIFICACION } from '../src/services/notificacionesService.js';

const ANDRES_ID = 1;

const tokens = await DispositivosPush.findAll({
  where: { usuario_id: ANDRES_ID },
  order: [['id', 'ASC']],
});

console.log('\n=== Tokens Andrés ===');
console.table(tokens.map((t) => ({
  id: t.id,
  plataforma: t.plataforma,
  token: t.push_token,
  created_at: t.created_at,
  updated_at: t.updated_at,
})));

if (tokens.length > 1) {
  const [, ...viejos] = [...tokens].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  for (const v of viejos) {
    await v.destroy();
    console.log('Eliminado token duplicado id=', v.id);
  }
}

const notificacion = await crearNotificacion({
  usuarioId: ANDRES_ID,
  tipo: TIPOS_NOTIFICACION.NUEVO_SEGUIDOR,
  mensaje: '**Prueba #3**: confirma si llega 1 sola push 🔔',
  referenciaId: 14,
  referenciaTipo: 'USER',
});

console.log('\nNotificación id=', notificacion?.id);
console.log('Tokens al enviar:', await DispositivosPush.count({ where: { usuario_id: ANDRES_ID } }));

await sequelize.close();
