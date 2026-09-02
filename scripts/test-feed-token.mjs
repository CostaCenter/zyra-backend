import sequelize from '../src/config/database.js';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const [users14] = await sequelize.query(`SELECT id, nick, telefono FROM "user" WHERE id = 14`);
console.log('User 14:', users14[0]);

const [seed01] = await sequelize.query(`SELECT id, nick, telefono FROM "user" WHERE nick = 'SEED_jugador_01'`);
console.log('SEED_jugador_01:', seed01[0]);

// Probar feed con token fresco para user 1 (Andres)
const userId = 1;
const token = jwt.sign({ id: userId, role: 'JUGADOR' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const res = await fetch('http://localhost:3000/api/publicaciones/feed?limit=3', {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await res.json();
console.log('\nFeed status:', res.status);
console.log('Feed items:', body.data?.length ?? 0);
if (body.data?.[0]) {
  console.log('Primera pub:', { id: body.data[0].id, caption: body.data[0].caption?.slice(0, 40) });
}

await sequelize.close();
