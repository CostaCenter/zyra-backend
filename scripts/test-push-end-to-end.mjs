#!/usr/bin/env node

/**
 * Script de prueba end-to-end del sistema de push notifications
 * Simula el flujo completo: crear notificación → enviar push → verificar receipt
 */

import { notificacionesService } from '../src/services/notificacionesService.js';
import { DispositivosPush, User } from '../src/db/db.js';

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 PRUEBA END-TO-END: SISTEMA DE PUSH NOTIFICATIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const usuarioId = process.argv[2];

if (!usuarioId) {
  console.error('❌ Error: Falta el usuario_id\n');
  console.error('Uso:');
  console.error('  node scripts/test-push-end-to-end.mjs [USUARIO_ID]\n');
  console.error('Ejemplo:');
  console.error('  node scripts/test-push-end-to-end.mjs 123\n');
  process.exit(1);
}

async function testEndToEnd() {
  console.log(`1️⃣  Verificando usuario ${usuarioId}...`);
  
  // Verificar que el usuario existe
  const usuario = await User.findByPk(usuarioId, {
    attributes: ['id', 'name', 'nick'],
  });

  if (!usuario) {
    console.error(`\n❌ ERROR: Usuario con ID ${usuarioId} no encontrado en la BD\n`);
    process.exit(1);
  }

  console.log(`   ✅ Usuario encontrado: ${usuario.name || usuario.nick}`);

  // Verificar que el usuario tiene tokens registrados
  const dispositivos = await DispositivosPush.findAll({
    where: { usuario_id: usuarioId },
    attributes: ['id', 'push_token', 'plataforma', 'created_at'],
  });

  if (!dispositivos.length) {
    console.error(`\n❌ ERROR: El usuario ${usuarioId} no tiene tokens de push registrados\n`);
    console.error('📋 SOLUCIÓN:');
    console.error('   1. Abrir la app en un dispositivo físico');
    console.error('   2. Hacer login con este usuario');
    console.error('   3. Verificar que el token se registre en la tabla dispositivos_push\n');
    process.exit(1);
  }

  console.log(`   ✅ Tokens registrados: ${dispositivos.length}`);
  dispositivos.forEach((d) => {
    console.log(`      • ${d.plataforma}: ${d.push_token.substring(0, 40)}... (${d.created_at})`);
  });

  console.log('\n2️⃣  Creando notificación de prueba...');

  // Importar función de notificaciones
  const { crearNotificacion } = await import('../src/services/notificacionesService.js');

  const notificacion = await crearNotificacion({
    usuario_id: usuarioId,
    tipo: 'SISTEMA',
    categoria: 'general',
    mensaje: `🧪 **Prueba de push notification** - ${new Date().toLocaleTimeString()}`,
    referencia_tipo: 'TEST',
    referencia_id: null,
    metadata: { test: true },
  });

  console.log(`   ✅ Notificación creada con ID: ${notificacion.id}`);

  console.log('\n3️⃣  Enviando push con verificación de receipt...');
  console.log('   (Esto tomará ~20 segundos para verificar la entrega real)\n');

  // Importar el servicio actualizado
  const { enviarPushNotificacionUsuario } = await import('../src/services/pushNotificationService.js');

  const navegacion = {
    destino: 'MainTabs',
    params: {},
  };

  try {
    await enviarPushNotificacionUsuario(
      usuarioId,
      { notificacion, navegacion },
      { verificarEntrega: true }, // ← Habilitar verificación de receipts
    );

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ PRUEBA COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 VERIFICAR EN EL DISPOSITIVO:');
    console.log('   1. Debe haber aparecido una notificación de prueba');
    console.log('   2. Al tocarla, la app debe abrirse');
    console.log('   3. En la pestaña de notificaciones debe aparecer\n');
    console.log('📊 REVISAR LOS LOGS ARRIBA:');
    console.log('   • Si dice "✅ Entrega confirmada" → El sistema funciona perfectamente');
    console.log('   • Si dice "❌ Entrega fallida" → Hay un problema de configuración');
    console.log('   • Si no dice nada → Verificación de receipts no está activa\n');
    console.log('📖 PRÓXIMOS PASOS:');
    console.log('   1. Si la entrega fue confirmada pero no aparece en el dispositivo:');
    console.log('      → Revisar permisos de notificaciones en el dispositivo');
    console.log('      → Verificar que la app esté actualizada');
    console.log('   2. Si la entrega falló:');
    console.log('      → Ejecutar: node scripts/test-push-with-receipt.mjs [TOKEN]');
    console.log('      → Revisar credenciales FCM en Expo Dashboard\n');

  } catch (error) {
    console.error('\n❌ ERROR al enviar push:', error);
    console.error('\n📋 POSIBLES CAUSAS:');
    console.error('   • Credenciales FCM no configuradas en Expo');
    console.error('   • Token de push inválido o expirado');
    console.error('   • Problema de conexión con Expo API\n');
    process.exit(1);
  }

  process.exit(0);
}

testEndToEnd().catch((error) => {
  console.error('\n💥 ERROR INESPERADO:', error);
  process.exit(1);
});
