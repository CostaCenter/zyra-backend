#!/usr/bin/env node
/**
 * Busca un usuario por nombre y envía push de prueba (local o Railway).
 *
 * Uso:
 *   node scripts/enviar-push-usuario.mjs "Kevin Orrego"
 *
 * Railway:
 *   $env:DATABASE_PUBLIC_URL="postgresql://..."
 *   node scripts/enviar-push-usuario.mjs "Kevin Orrego"
 */

import pg from 'pg';

const nameQuery = process.argv[2];
if (!nameQuery) {
  console.error('Uso: node scripts/enviar-push-usuario.mjs "Nombre Usuario"');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.TARGET_DATABASE_URL;

const client = dbUrl
  ? new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  : new pg.Client({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'zyra',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '123',
    });

const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';

await client.connect();
console.log(`🔍 Buscando: ${nameQuery}`);
console.log(`📦 BD: ${dbUrl ? 'Railway (producción)' : 'local'}\n`);

const { rows: users } = await client.query(
  `SELECT id, name, nick, telefono FROM "user"
   WHERE name ILIKE $1 OR nick ILIKE $1
   ORDER BY id DESC LIMIT 3`,
  [`%${nameQuery}%`],
);

if (!users.length) {
  console.error(`❌ Usuario "${nameQuery}" no encontrado en esta BD.`);
  console.error('   Si creaste el usuario en el APK, usa DATABASE_PUBLIC_URL de Railway.\n');
  await client.end();
  process.exit(1);
}

const user = users[0];
console.log(`✅ Usuario: ${user.name || user.nick} (id=${user.id}, tel=${user.telefono || '—'})\n`);

const { rows: tokens } = await client.query(
  `SELECT push_token, plataforma, updated_at FROM dispositivos_push
   WHERE usuario_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
  [user.id],
);

if (!tokens.length) {
  console.error('❌ Sin token push registrado para este usuario.');
  console.error('   Abre el APK, login con Kevin, acepta notificaciones y reintenta.\n');
  await client.end();
  process.exit(1);
}

const token = tokens[0].push_token;
console.log(`📱 Token (${tokens[0].plataforma}): ${token.substring(0, 45)}...`);
console.log(`   Registrado: ${tokens[0].updated_at}\n`);

console.log('📤 Enviando push...');
const sendRes = await fetch(EXPO_SEND, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify([{
    to: token,
    title: 'Zyra',
    body: `Hola ${user.name?.split(' ')[0] || 'Kevin'}, prueba de notificación 🔔`,
    sound: 'default',
    channelId: 'default',
    data: { test: true, destino: 'MainTabs', params: '{}' },
  }]),
});

const sendData = await sendRes.json();
const ticket = sendData.data?.[0];
console.log('Ticket:', JSON.stringify(ticket, null, 2));

if (ticket?.status !== 'ok') {
  await client.end();
  process.exit(1);
}

console.log('\n⏳ Esperando receipt (15s)...');
await new Promise((r) => setTimeout(r, 15000));

const receiptRes = await fetch(EXPO_RECEIPTS, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [ticket.id] }),
});
const receipt = (await receiptRes.json()).data?.[ticket.id];
console.log('Receipt:', JSON.stringify(receipt, null, 2));

if (receipt?.status === 'ok') {
  console.log('\n✅ Push entregado. Revisa el teléfono de Kevin.\n');
} else {
  console.log('\n❌ Push no entregado. Token inválido o FCM mal configurado.\n');
}

await client.end();
