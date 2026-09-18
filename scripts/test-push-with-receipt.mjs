// test-push-with-receipt.js
// Script de prueba para verificar push notifications con receipts reales
// Uso: node test-push-with-receipt.js "ExponentPushToken[tu-token-aqui]"

const EXPO_PUSH_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';

async function testPushWithReceipt(token) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST DE PUSH NOTIFICATION CON VERIFICACIÓN DE RECEIPT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`📱 Token: ${token.substring(0, 40)}...\n`);
  
  // ========== PASO 1: ENVIAR PUSH ==========
  console.log('1️⃣  ENVIANDO PUSH NOTIFICATION...');
  console.log('   Endpoint:', EXPO_PUSH_SEND);
  
  const sendResponse = await fetch(EXPO_PUSH_SEND, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{
      to: token,
      title: '🧪 Test Auditoría Push',
      body: `Prueba de entrega real - ${new Date().toLocaleTimeString()}`,
      sound: 'default',
      channelId: 'default',
      data: { test: true, timestamp: Date.now() },
    }]),
  });

  if (!sendResponse.ok) {
    console.error(`\n❌ ERROR HTTP: ${sendResponse.status} ${sendResponse.statusText}`);
    const text = await sendResponse.text();
    console.error('   Respuesta:', text);
    return;
  }

  const sendData = await sendResponse.json();
  console.log('\n📤 RESPUESTA DEL ENVÍO:');
  console.log(JSON.stringify(sendData, null, 2));

  const ticket = sendData.data?.[0];
  if (!ticket) {
    console.error('\n❌ No se recibió ticket en la respuesta');
    return;
  }

  // ========== ANÁLISIS DEL TICKET ==========
  console.log('\n📋 ANÁLISIS DEL TICKET:');
  console.log(`   Status: ${ticket.status}`);
  
  if (ticket.status === 'error') {
    console.error('\n❌ ERROR EN EL TICKET:');
    console.error(`   Mensaje: ${ticket.message}`);
    console.error(`   Detalles:`, JSON.stringify(ticket.details, null, 2));
    console.error('\n🔍 POSIBLES CAUSAS:');
    
    if (ticket.details?.error === 'DeviceNotRegistered') {
      console.error('   • El token ha expirado o el usuario desinstaló la app');
      console.error('   • Solución: Limpiar este token de la base de datos');
    } else if (ticket.details?.error === 'InvalidCredentials') {
      console.error('   • Las credenciales FCM en Expo están mal configuradas');
      console.error('   • Solución: Revisar Expo Dashboard → Credentials → FCM');
    } else if (ticket.message?.includes('project_id')) {
      console.error('   • El projectId no coincide o no existe en Expo');
      console.error('   • Solución: Verificar app.json extra.eas.projectId');
    } else {
      console.error('   • Error desconocido, revisar documentación de Expo');
    }
    return;
  }

  if (!ticket.id) {
    console.error('\n❌ El ticket no contiene un ID para verificar receipt');
    return;
  }

  const ticketId = ticket.id;
  console.log(`   Ticket ID: ${ticketId}`);
  console.log('\n✅ Ticket recibido correctamente (status: ok)');
  console.log('\n⚠️  IMPORTANTE: Un ticket "ok" NO garantiza entrega.');
  console.log('   Debemos consultar el RECEIPT para confirmar entrega real.\n');
  
  // ========== ESPERA ==========
  const waitSeconds = 15;
  console.log(`⏳ Esperando ${waitSeconds} segundos antes de consultar receipt...`);
  
  for (let i = waitSeconds; i > 0; i--) {
    process.stdout.write(`   ${i} segundos restantes...\r`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('                                 '); // Limpiar línea
  
  // ========== PASO 2: CONSULTAR RECEIPT ==========
  console.log('\n2️⃣  CONSULTANDO RECEIPT REAL...');
  console.log('   Endpoint:', EXPO_PUSH_RECEIPTS);
  console.log(`   Ticket ID: ${ticketId}\n`);
  
  const receiptResponse = await fetch(EXPO_PUSH_RECEIPTS, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [ticketId] }),
  });

  if (!receiptResponse.ok) {
    console.error(`\n❌ ERROR HTTP al consultar receipt: ${receiptResponse.status}`);
    const text = await receiptResponse.text();
    console.error('   Respuesta:', text);
    return;
  }

  const receiptData = await receiptResponse.json();
  console.log('📥 RESPUESTA DEL RECEIPT:');
  console.log(JSON.stringify(receiptData, null, 2));

  const receipt = receiptData.data?.[ticketId];
  if (!receipt) {
    console.error('\n❌ No se encontró receipt para el ticket');
    console.error('   Esto puede ocurrir si Expo aún no procesó el push (muy raro)');
    console.error('   Intenta ejecutar el script nuevamente en 30 segundos');
    return;
  }

  // ========== ANÁLISIS DEL RECEIPT ==========
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESULTADO FINAL DEL RECEIPT:');
  console.log(`   Status: ${receipt.status}`);

  if (receipt.status === 'ok') {
    console.log('\n✅✅✅ ¡ÉXITO CONFIRMADO!');
    console.log('   El push notification fue REALMENTE ENTREGADO al dispositivo.');
    console.log('   Este es el nivel de verificación que el código debe implementar.\n');
    console.log('🔍 DIAGNÓSTICO:');
    console.log('   • El sistema de push FUNCIONA correctamente');
    console.log('   • El problema está en la LÓGICA de cuándo/cómo se envían');
    console.log('   • Revisar: notificacionesService.js, condiciones de envío');
  } else {
    console.error('\n❌❌❌ FALLO CONFIRMADO');
    console.error(`   Mensaje: ${receipt.message}`);
    console.error(`   Detalles:`, JSON.stringify(receipt.details, null, 2));
    console.error('\n🔍 DIAGNÓSTICO:');
    
    if (receipt.details?.error === 'DeviceNotRegistered') {
      console.error('   • El token es inválido o el dispositivo desinstaló la app');
      console.error('   • Este token debe ser eliminado de la base de datos');
      console.error('   • El usuario debe volver a abrir la app para registrar un nuevo token');
    } else if (receipt.details?.error === 'InvalidCredentials') {
      console.error('   • Las credenciales FCM están MAL CONFIGURADAS en Expo');
      console.error('   • Ir a: expo.dev → modukabo → appZyra → Credentials → Android FCM');
      console.error('   • Verificar que el Server Key o Service Account JSON sean correctos');
      console.error('   • Verificar que el package_name sea: com.zyra.appzyra');
    } else if (receipt.details?.error === 'MessageTooBig') {
      console.error('   • El payload del push supera el límite de 4KB');
      console.error('   • Reducir el tamaño del campo "data" o del mensaje');
    } else if (receipt.details?.error === 'MessageRateExceeded') {
      console.error('   • Se superó el límite de mensajes por dispositivo');
      console.error('   • Implementar throttling o deduplicación');
    } else {
      console.error('   • Error desconocido, consultar documentación de Expo:');
      console.error('     https://docs.expo.dev/push-notifications/sending-notifications/');
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
}

// ========== EJECUCIÓN ==========
const token = process.argv[2];

if (!token) {
  console.error('❌ Error: Falta el token de push\n');
  console.error('Uso:');
  console.error('  node test-push-with-receipt.js "ExponentPushToken[...]"\n');
  console.error('Para obtener un token de la base de datos:');
  console.error('  SELECT push_token FROM dispositivos_push WHERE usuario_id = [TU_ID] LIMIT 1;\n');
  process.exit(1);
}

if (!token.startsWith('ExponentPushToken[')) {
  console.error('❌ Error: El token no tiene el formato correcto\n');
  console.error('Los tokens de Expo deben comenzar con: ExponentPushToken[');
  console.error('Token proporcionado:', token, '\n');
  process.exit(1);
}

testPushWithReceipt(token).catch((error) => {
  console.error('\n💥 ERROR INESPERADO:');
  console.error(error);
  process.exit(1);
});
