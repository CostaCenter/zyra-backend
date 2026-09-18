#!/usr/bin/env node
/**
 * Diagnóstico completo de push notifications:
 * 1) Config local (app.json, google-services, receipts)
 * 2) Conexión a BD y tokens recientes
 * 3) Prueba Expo ticket + receipt (si hay token)
 * 4) Health del backend de producción
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const APP_ROOT = resolve(ROOT, '..', 'appZyra');

const EXPO_PUSH_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';
const PROD_API = 'https://web-production-ed7ea.up.railway.app';
const RECEIPT_WAIT_MS = 15000;

const args = process.argv.slice(2);
const tokenArg = args.find((a) => a.startsWith('ExponentPushToken[')) ?? null;
const usuarioArg = args.find((a) => /^\d+$/.test(a)) ?? null;

const report = {
  config: { ok: [], warn: [], error: [] },
  database: { ok: [], warn: [], error: [], tokens: [] },
  pushTest: { ok: [], warn: [], error: [], ticket: null, receipt: null },
  backend: { ok: [], warn: [], error: [] },
};

function push(section, level, msg) {
  report[section][level].push(msg);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.EXTERNAL_DATABASE_URL,
    process.env.RAILWAY_PUBLIC_DATABASE_URL,
  ].filter(Boolean);

  if (candidates.length) return candidates[0];

  const envFiles = ['.env', 'railway.production.env'];
  for (const file of envFiles) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf8');
    const match = content.match(/^DATABASE_URL=(.+)$/m);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function checkConfig() {
  console.log('1️⃣  Configuración local...\n');

  try {
    const appJson = readJson(join(APP_ROOT, 'app.json'));
    const google = readJson(join(APP_ROOT, 'google-services.json'));
    const pkgJson = readJson(join(APP_ROOT, 'package.json'));
    const pushService = readFileSync(join(ROOT, 'src/services/pushNotificationService.js'), 'utf8');

    const projectId = appJson?.expo?.extra?.eas?.projectId;
    const androidPackage = appJson?.expo?.android?.package;
    const firebasePackage = google?.client?.[0]?.client_info?.android_client_info?.package_name;

    if (!projectId) push('config', 'error', 'Falta extra.eas.projectId en app.json');
    else push('config', 'ok', `Project ID: ${projectId}`);

    if (androidPackage !== firebasePackage) {
      push('config', 'error', `Package mismatch: app.json=${androidPackage}, google-services=${firebasePackage}`);
    } else {
      push('config', 'ok', `Package name consistente: ${androidPackage}`);
    }

    if (!pkgJson.dependencies?.['expo-notifications']) {
      push('config', 'error', 'expo-notifications no instalado');
    } else {
      push('config', 'ok', `expo-notifications: ${pkgJson.dependencies['expo-notifications']}`);
    }

    if (!pushService.includes('consultarReceipts') || !pushService.includes('EXPO_RECEIPTS_URL')) {
      push('config', 'error', 'Sistema de receipts NO implementado en backend');
    } else {
      push('config', 'ok', 'Sistema de receipts implementado en pushNotificationService.js');
    }

    if (google?.project_info?.project_id) {
      push('config', 'ok', `Firebase project: ${google.project_info.project_id}`);
    }
  } catch (e) {
    push('config', 'error', `Error leyendo config: ${e.message}`);
  }
}

async function checkBackendHealth() {
  console.log('2️⃣  Backend de producción...\n');
  try {
    const res = await fetch(`${PROD_API}/api/app/version`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      push('backend', 'error', `API producción respondió HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    push('backend', 'ok', `API producción online (${PROD_API})`);
    if (data?.data?.latestVersion) {
      push('backend', 'ok', `Versión app expuesta: ${data.data.latestVersion}`);
    }
  } catch (e) {
    push('backend', 'error', `No se pudo contactar API producción: ${e.message}`);
  }
}

async function fetchTokensFromDb() {
  console.log('3️⃣  Tokens en base de datos...\n');

  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) {
    push('database', 'warn', 'No hay DATABASE_URL accesible desde este entorno');
    push('database', 'warn', 'Pasa un token manual: node scripts/diagnostico-push-completo.mjs "ExponentPushToken[...]"');
    return null;
  }

  if (dbUrl.includes('railway.internal')) {
    push('database', 'warn', 'DATABASE_URL es interna de Railway (postgres.railway.internal) — no accesible desde tu PC');
    push('database', 'warn', 'Opciones: usar token manual, o DATABASE_URL pública de Railway');
    return null;
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('sslmode=require') || dbUrl.includes('railway.app') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    push('database', 'ok', 'Conexión a PostgreSQL exitosa');

    let query = `
      SELECT id, usuario_id, push_token, plataforma, created_at, updated_at
      FROM dispositivos_push
    `;
    const params = [];

    if (usuarioArg) {
      query += ' WHERE usuario_id = $1';
      params.push(Number(usuarioArg));
    }

    query += ' ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 5';

    const { rows } = await client.query(query, params);
    report.database.tokens = rows;

    if (!rows.length) {
      push('database', 'warn', 'No hay tokens registrados en dispositivos_push');
      return null;
    }

    push('database', 'ok', `Tokens encontrados: ${rows.length}`);
    rows.forEach((r, i) => {
      console.log(`   ${i + 1}. usuario=${r.usuario_id} plataforma=${r.plataforma} token=${r.push_token.substring(0, 45)}...`);
    });

    return tokenArg ?? rows[0].push_token;
  } catch (e) {
    push('database', 'error', `Error consultando BD: ${e.message}`);
    return tokenArg;
  } finally {
    await client.end().catch(() => {});
  }
}

async function testPushWithReceipt(token) {
  console.log('\n4️⃣  Prueba Expo: ticket + receipt...\n');
  console.log(`   Token: ${token.substring(0, 50)}...\n`);

  const sendRes = await fetch(EXPO_PUSH_SEND, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      to: token,
      title: '🧪 Diagnóstico Zyra',
      body: `Prueba ${new Date().toLocaleTimeString()}`,
      sound: 'default',
      channelId: 'default',
      data: { diagnostico: true },
    }]),
  });

  if (!sendRes.ok) {
    push('pushTest', 'error', `Expo /push/send HTTP ${sendRes.status}`);
    return;
  }

  const sendData = await sendRes.json();
  const ticket = sendData.data?.[0];
  report.pushTest.ticket = ticket;

  if (!ticket) {
    push('pushTest', 'error', 'Expo no devolvió ticket');
    return;
  }

  if (ticket.status === 'error') {
    push('pushTest', 'error', `Ticket error: ${ticket.message}`);
    if (ticket.details?.error) push('pushTest', 'error', `Detalle: ${ticket.details.error}`);
    return;
  }

  push('pushTest', 'ok', `Ticket OK (id=${ticket.id?.substring(0, 24)}...)`);
  console.log(`   ⏳ Esperando ${RECEIPT_WAIT_MS / 1000}s para receipt...`);

  await new Promise((r) => setTimeout(r, RECEIPT_WAIT_MS));

  const receiptRes = await fetch(EXPO_PUSH_RECEIPTS, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [ticket.id] }),
  });

  if (!receiptRes.ok) {
    push('pushTest', 'error', `Expo /push/getReceipts HTTP ${receiptRes.status}`);
    return;
  }

  const receiptData = await receiptRes.json();
  const receipt = receiptData.data?.[ticket.id];
  report.pushTest.receipt = receipt;

  if (!receipt) {
    push('pushTest', 'warn', 'Receipt aún no disponible (reintentar en 30s)');
    return;
  }

  if (receipt.status === 'ok') {
    push('pushTest', 'ok', '✅ RECEIPT OK — entrega confirmada por Expo/FCM');
  } else {
    push('pushTest', 'error', `❌ RECEIPT ERROR: ${receipt.message}`);
    if (receipt.details?.error) push('pushTest', 'error', `Detalle receipt: ${receipt.details.error}`);
  }
}

function printSection(title, section) {
  console.log(`\n── ${title} ──`);
  section.ok.forEach((m) => console.log(`   ✅ ${m}`));
  section.warn.forEach((m) => console.log(`   ⚠️  ${m}`));
  section.error.forEach((m) => console.log(`   ❌ ${m}`));
}

function finalDiagnosis() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🩺 DIAGNÓSTICO FINAL');
  console.log('═══════════════════════════════════════════════════════════\n');

  const hasConfigErrors = report.config.error.length > 0;
  const hasReceiptOk = report.pushTest.ok.some((m) => m.includes('RECEIPT OK'));
  const hasReceiptError = report.pushTest.error.some((m) => m.includes('RECEIPT ERROR'));
  const hasInvalidCredentials = [...report.pushTest.error].some((m) =>
    m.includes('InvalidCredentials') || m.toLowerCase().includes('invalid credentials'),
  );
  const hasDeviceNotRegistered = [...report.pushTest.error].some((m) =>
    m.includes('DeviceNotRegistered') || m.includes('not a registered'),
  );
  const noTokenTest = report.pushTest.ticket == null && report.pushTest.receipt == null;

  if (hasConfigErrors) {
    console.log('🔴 BLOQUEANTE: Hay errores de configuración local. Corrígelos antes del APK.');
  } else if (hasReceiptOk) {
    console.log('🟢 LISTO PARA APK (push): Config OK + receipt confirmó entrega real.');
    console.log('   Puedes generar el APK con más confianza. Despliega también el backend con receipts.');
  } else if (hasInvalidCredentials) {
    console.log('🔴 NO generes APK todavía: credenciales FCM inválidas en Expo/Firebase.');
    console.log('   Revisa: expo.dev → modukabo → appZyra → Credentials → Android FCM');
  } else if (hasDeviceNotRegistered) {
    console.log('🟡 Config probablemente OK, pero el token probado está expirado.');
    console.log('   Abre la app en un dispositivo físico, login, y repite con token nuevo.');
  } else if (noTokenTest) {
    console.log('🟡 Config local OK, pero falta prueba con token real.');
    console.log('   No puedo confirmar entrega sin token de dispositivos_push.');
    console.log('\n   Ejecuta:');
    console.log('   node scripts/diagnostico-push-completo.mjs "ExponentPushToken[...]"');
  } else if (hasReceiptError) {
    console.log('🔴 Push falló en receipt. Revisa credenciales FCM y permisos del dispositivo.');
  } else {
    console.log('🟡 Estado intermedio: revisa los detalles arriba.');
  }

  console.log('\n📋 Acciones sugeridas:');
  if (noTokenTest) {
    console.log('   1. Obtén token: SELECT push_token FROM dispositivos_push ORDER BY updated_at DESC LIMIT 1;');
    console.log('   2. Repite diagnóstico con ese token');
  }
  if (!hasReceiptOk) {
    console.log('   • Verifica FCM en Expo Dashboard');
    console.log('   • Verifica GOOGLE_SERVICES_JSON en EAS (eas secret:list)');
  }
  if (hasReceiptOk) {
    console.log('   • npm run build:preview:android');
    console.log('   • Despliega backend-zyra con pushNotificationService.js actualizado');
  }
  console.log('');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🩺 DIAGNÓSTICO COMPLETO — PUSH NOTIFICATIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  checkConfig();
  await checkBackendHealth();

  const token = tokenArg ?? (await fetchTokensFromDb());

  if (token) {
    await testPushWithReceipt(token);
  } else if (!tokenArg) {
    push('pushTest', 'warn', 'Prueba ticket+receipt omitida (sin token disponible)');
  }

  printSection('Config', report.config);
  printSection('Backend', report.backend);
  printSection('Base de datos', report.database);
  printSection('Prueba push', report.pushTest);

  finalDiagnosis();
}

main().catch((e) => {
  console.error('\n💥 Error fatal:', e);
  process.exit(1);
});
