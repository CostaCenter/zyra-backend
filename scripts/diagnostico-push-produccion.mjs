#!/usr/bin/env node
/**
 * Diagnóstico push en PRODUCCIÓN (Railway).
 *
 * Uso (PowerShell):
 *   $env:DATABASE_PUBLIC_URL="postgresql://...@HOST.railway.app:PORT/railway"
 *   node scripts/diagnostico-push-produccion.mjs [usuario_id]
 *
 * Obtén DATABASE_PUBLIC_URL en Railway → Postgres → Connect → Public Network
 */

import pg from 'pg';

const usuarioId = Number(process.argv[2] || 1);
const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.TARGET_DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Falta DATABASE_PUBLIC_URL (URL pública de Postgres en Railway)\n');
  process.exit(1);
}

if (dbUrl.includes('railway.internal')) {
  console.error('❌ Usa la Public URL, no railway.internal\n');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log(`🔍 Tokens en Railway para usuario_id=${usuarioId}\n`);

  const { rows: users } = await client.query(
    'SELECT id, name, nick FROM "user" WHERE id = $1',
    [usuarioId],
  );
  if (!users.length) {
    console.error('❌ Usuario no encontrado en Railway');
    process.exit(1);
  }
  console.log(`Usuario: ${users[0].name || users[0].nick}\n`);

  const { rows: tokens } = await client.query(
    `SELECT id, push_token, plataforma, created_at, updated_at
     FROM dispositivos_push
     WHERE usuario_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
    [usuarioId],
  );

  if (!tokens.length) {
    console.log('❌ SIN TOKENS en Railway para este usuario.\n');
    console.log('📋 El APK no registró el token push. Haz esto:');
    console.log('   1. Abre el APK (no Expo Go)');
    console.log('   2. Login con este usuario');
    console.log('   3. Acepta permisos de notificaciones');
    console.log('   4. Cierra y reabre la app');
    console.log('   5. Vuelve a ejecutar este script\n');
    process.exit(1);
  }

  console.log(`✅ ${tokens.length} token(s) en Railway:\n`);
  tokens.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.plataforma} | ${t.push_token}`);
    console.log(`     updated: ${t.updated_at || t.created_at}\n`);
  });

  const token = tokens[0].push_token;
  console.log('🧪 Enviando push de prueba al token más reciente...\n');

  const sendRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      to: token,
      title: '🧪 Prueba APK / Railway',
      body: `Diagnóstico producción ${new Date().toLocaleTimeString()}`,
      sound: 'default',
      channelId: 'default',
    }]),
  });

  const sendData = await sendRes.json();
  const ticket = sendData.data?.[0];
  console.log('Ticket:', JSON.stringify(ticket, null, 2));

  if (ticket?.status !== 'ok') {
    console.log('\n❌ Expo rechazó el envío. Token inválido o credenciales FCM mal.');
    process.exit(1);
  }

  console.log('\n⏳ Esperando 15s para receipt...');
  await new Promise((r) => setTimeout(r, 15000));

  const receiptRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [ticket.id] }),
  });
  const receiptData = await receiptRes.json();
  const receipt = receiptData.data?.[ticket.id];
  console.log('Receipt:', JSON.stringify(receipt, null, 2));

  if (receipt?.status === 'ok') {
    console.log('\n✅ Push entregado por Expo/FCM al token del APK.');
    console.log('   Si no lo ves: revisa Configuración → Apps → Zyra → Notificaciones\n');
  } else {
    console.log('\n❌ Receipt falló. Reinstala el APK, login, y repite.\n');
  }

  await client.end();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
