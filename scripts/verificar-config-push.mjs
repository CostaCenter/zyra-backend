#!/usr/bin/env node

/**
 * Script de verificación rápida de configuración de push notifications
 * Compara todos los valores críticos para detectar inconsistencias
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 VERIFICACIÓN DE CONFIGURACIÓN DE PUSH NOTIFICATIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const appZyraPath = resolve(process.cwd(), '..');
const errors = [];
const warnings = [];
const success = [];

// ========== 1. LEER app.json ==========
console.log('1️⃣  Verificando app.json...');
let appJson;
try {
  const appJsonPath = resolve(appZyraPath, 'appZyra', 'app.json');
  appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  success.push('✅ app.json leído correctamente');
} catch (error) {
  errors.push(`❌ No se pudo leer app.json: ${error.message}`);
  process.exit(1);
}

const projectId = appJson?.expo?.extra?.eas?.projectId;
const androidPackage = appJson?.expo?.android?.package;
const iosBundle = appJson?.expo?.ios?.bundleIdentifier;
const updatesUrl = appJson?.expo?.updates?.url;
const appVersion = appJson?.expo?.version;
const runtimeVersion = appJson?.expo?.runtimeVersion?.policy;

console.log(`   Project ID: ${projectId}`);
console.log(`   Android Package: ${androidPackage}`);
console.log(`   iOS Bundle: ${iosBundle}`);
console.log(`   App Version: ${appVersion}`);
console.log(`   Runtime Version Policy: ${runtimeVersion}\n`);

if (!projectId) {
  errors.push('❌ Falta extra.eas.projectId en app.json');
} else {
  success.push(`✅ Project ID encontrado: ${projectId}`);
}

if (!androidPackage) {
  errors.push('❌ Falta android.package en app.json');
} else {
  success.push(`✅ Android package: ${androidPackage}`);
}

// Verificar consistencia en updates URL
if (updatesUrl && !updatesUrl.includes(projectId)) {
  warnings.push(`⚠️  La URL de updates no contiene el projectId: ${updatesUrl}`);
}

// ========== 2. LEER google-services.json ==========
console.log('2️⃣  Verificando google-services.json...');
let googleServices;
try {
  const googleServicesPath = resolve(appZyraPath, 'appZyra', 'google-services.json');
  googleServices = JSON.parse(readFileSync(googleServicesPath, 'utf8'));
  success.push('✅ google-services.json leído correctamente');
} catch (error) {
  errors.push(`❌ No se pudo leer google-services.json: ${error.message}`);
  process.exit(1);
}

const firebaseProjectId = googleServices?.project_info?.project_id;
const firebasePackageName = googleServices?.client?.[0]?.client_info?.android_client_info?.package_name;

console.log(`   Firebase Project ID: ${firebaseProjectId}`);
console.log(`   Package Name: ${firebasePackageName}\n`);

if (!firebasePackageName) {
  errors.push('❌ No se encontró package_name en google-services.json');
} else {
  success.push(`✅ Firebase package name: ${firebasePackageName}`);
}

// ========== 3. COMPARAR PACKAGE NAMES ==========
console.log('3️⃣  Comparando package names...');
if (androidPackage !== firebasePackageName) {
  errors.push(
    `❌ INCONSISTENCIA: Package names no coinciden:\n` +
    `   app.json: ${androidPackage}\n` +
    `   google-services.json: ${firebasePackageName}`,
  );
} else {
  success.push(`✅ Package names coinciden: ${androidPackage}`);
}

// ========== 4. VERIFICAR eas.json ==========
console.log('\n4️⃣  Verificando eas.json...');
let easJson;
try {
  const easJsonPath = resolve(appZyraPath, 'appZyra', 'eas.json');
  easJson = JSON.parse(readFileSync(easJsonPath, 'utf8'));
  success.push('✅ eas.json leído correctamente');
} catch (error) {
  errors.push(`❌ No se pudo leer eas.json: ${error.message}`);
}

const previewChannel = easJson?.build?.preview?.channel;
const productionChannel = easJson?.build?.production?.channel;
const updatePreviewChannel = easJson?.update?.preview?.channel;
const updateProductionChannel = easJson?.update?.production?.channel;

console.log(`   Build Preview Channel: ${previewChannel}`);
console.log(`   Build Production Channel: ${productionChannel}`);
console.log(`   Update Preview Channel: ${updatePreviewChannel}`);
console.log(`   Update Production Channel: ${updateProductionChannel}\n`);

if (previewChannel !== updatePreviewChannel) {
  warnings.push(
    `⚠️  Canales de preview no coinciden:\n` +
    `   build.preview.channel: ${previewChannel}\n` +
    `   update.preview.channel: ${updatePreviewChannel}`,
  );
}

if (productionChannel !== updateProductionChannel) {
  warnings.push(
    `⚠️  Canales de production no coinciden:\n` +
    `   build.production.channel: ${productionChannel}\n` +
    `   update.production.channel: ${updateProductionChannel}`,
  );
}

// ========== 5. VERIFICAR package.json ==========
console.log('5️⃣  Verificando dependencias en package.json...');
let packageJson;
try {
  const packageJsonPath = resolve(appZyraPath, 'appZyra', 'package.json');
  packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  success.push('✅ package.json leído correctamente');
} catch (error) {
  errors.push(`❌ No se pudo leer package.json: ${error.message}`);
}

const expoNotificationsVersion = packageJson?.dependencies?.['expo-notifications'];
const expoUpdatesVersion = packageJson?.dependencies?.['expo-updates'];

console.log(`   expo-notifications: ${expoNotificationsVersion}`);
console.log(`   expo-updates: ${expoUpdatesVersion}\n`);

if (!expoNotificationsVersion) {
  errors.push('❌ expo-notifications no está instalado');
} else {
  success.push(`✅ expo-notifications instalado: ${expoNotificationsVersion}`);
}

if (!expoUpdatesVersion) {
  warnings.push('⚠️  expo-updates no está instalado (OTA updates deshabilitados)');
} else {
  success.push(`✅ expo-updates instalado: ${expoUpdatesVersion}`);
}

// ========== 6. VERIFICAR BACKEND pushNotificationService.js ==========
console.log('6️⃣  Verificando implementación de receipts en el backend...');
try {
  const pushServicePath = resolve(process.cwd(), 'src', 'services', 'pushNotificationService.js');
  const pushServiceContent = readFileSync(pushServicePath, 'utf8');
  
  if (pushServiceContent.includes('consultarReceipts')) {
    success.push('✅ Sistema de receipts implementado en pushNotificationService.js');
  } else {
    errors.push('❌ Sistema de receipts NO implementado en pushNotificationService.js');
  }

  if (pushServiceContent.includes('verificarReceipts')) {
    success.push('✅ Función verificarReceipts encontrada');
  } else {
    errors.push('❌ Función verificarReceipts no encontrada');
  }

  if (pushServiceContent.includes('EXPO_RECEIPTS_URL')) {
    success.push('✅ URL de receipts de Expo configurada');
  } else {
    errors.push('❌ URL de receipts de Expo no configurada');
  }
} catch (error) {
  errors.push(`❌ No se pudo leer pushNotificationService.js: ${error.message}`);
}

// ========== RESUMEN FINAL ==========
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('═══════════════════════════════════════════════════════════\n');

if (success.length > 0) {
  console.log('✅ ÉXITOS:');
  success.forEach((msg) => console.log(`   ${msg}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  ADVERTENCIAS:');
  warnings.forEach((msg) => console.log(`   ${msg}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ ERRORES CRÍTICOS:');
  errors.forEach((msg) => console.log(`   ${msg}`));
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');

if (errors.length > 0) {
  console.log(`\n🚨 ESTADO: FALLO (${errors.length} errores críticos encontrados)`);
  console.log('\n📋 PRÓXIMOS PASOS:');
  console.log('   1. Corregir los errores críticos listados arriba');
  console.log('   2. Ejecutar nuevamente este script para verificar');
  console.log('   3. Si todo está OK, ejecutar: node scripts/test-push-with-receipt.mjs\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log(`\n⚠️  ESTADO: ADVERTENCIAS (${warnings.length} advertencias encontradas)`);
  console.log('\n📋 PRÓXIMOS PASOS:');
  console.log('   1. Revisar las advertencias (no son críticas pero pueden causar problemas)');
  console.log('   2. Ejecutar: node scripts/test-push-with-receipt.mjs [TOKEN]\n');
  process.exit(0);
} else {
  console.log('\n✅ ESTADO: TODO CORRECTO');
  console.log('\n📋 PRÓXIMOS PASOS:');
  console.log('   1. Verificar credenciales FCM en Expo Dashboard');
  console.log('   2. Obtener un token de push de la BD:');
  console.log('      SELECT push_token FROM dispositivos_push LIMIT 1;');
  console.log('   3. Ejecutar prueba de entrega:');
  console.log('      node scripts/test-push-with-receipt.mjs "ExponentPushToken[...]"\n');
  process.exit(0);
}
