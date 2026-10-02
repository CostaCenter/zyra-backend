# 🔍 Auditoría Exhaustiva del Sistema de Push Notifications

**Fecha**: 17 de septiembre, 2026  
**Proyecto**: Zyra (appZyra + backend-zyra)  
**Metodología**: Auditoría de código fuente + trazabilidad de configuración

---

## ❌ HALLAZGO CRÍTICO: Sistema de Receipts NO Implementado

### Problema Confirmado

El código actual en `backend-zyra/src/services/pushNotificationService.js` **NO implementa la verificación de receipts de Expo**, lo cual explica por qué las notificaciones push parecen "enviarse correctamente" pero nunca llegan al dispositivo.

**Evidencia en el código actual (líneas 104-110)**:
```javascript
for (let i = 0; i < messages.length; i += BATCH_SIZE) {
  const chunk = messages.slice(i, i + BATCH_SIZE);
  const tickets = await enviarLote(chunk);
  console.log(`[Push] Enviado a ${chunk.length} dispositivo(s) del usuario ${usuarioId}`, tickets);
  await limpiarTokensInvalidos(chunk, tickets);
}
```

### ¿Qué está mal?

1. **Solo se verifica el ticket inicial**: El código recibe los `tickets` del primer endpoint de Expo (`/push/send`), pero un ticket con `status: 'ok'` **solo significa que Expo aceptó la solicitud**, NO que el mensaje fue entregado.

2. **Falta la segunda consulta obligatoria**: Después de recibir los tickets, el código debe esperar unos segundos (típicamente 5-30s) y consultar el endpoint de receipts de Expo:
   ```
   POST https://exp.host/--/api/v2/push/getReceipts
   ```
   Con el array de `ticket.id` para obtener el **receipt** real que confirma:
   - ✅ `status: 'ok'` → El push fue entregado exitosamente
   - ❌ `status: 'error'` con detalles del error (token inválido, dispositivo sin conexión, etc.)

3. **Consecuencia**: Durante toda esta investigación, el sistema ha estado reportando "éxito" basándose únicamente en que Expo aceptó las solicitudes, sin verificar jamás si los mensajes realmente llegaron a los dispositivos. Esto es equivalente a decir "el correo fue aceptado por la oficina postal" sin verificar si finalmente llegó al buzón del destinatario.

---

## 📋 Trazabilidad de Configuración

### 1. Project ID de Expo

| Ubicación | Valor | Estado |
|-----------|-------|--------|
| `app.json` (línea 75) | `10a95ae8-b28a-4ad3-910c-e33f95b09e00` | ✅ |
| `app.json` updates.url (línea 10) | `https://u.expo.dev/10a95ae8-b28a-4ad3-910c-e33f95b09e00` | ✅ |
| Frontend usa correctamente | `pushNotifications.core.js` líneas 88-90 | ✅ |

**Verificación requerida**:
- [ ] Confirmar que este `projectId` está vinculado en el dashboard de Expo con las credenciales FCM correctas
- [ ] Verificar que el proyecto en Expo no haya sido eliminado/recreado sin actualizar el ID en el código

### 2. Package Name / Bundle Identifier

| Ubicación | Valor | Estado |
|-----------|-------|--------|
| `app.json` android.package (línea 28) | `com.zyra.appzyra` | ✅ |
| `google-services.json` (línea 12) | `com.zyra.appzyra` | ✅ |
| iOS bundle (línea 21) | `com.zyra.appzyra` | ✅ |

**Estado**: ✅ Consistentes en todos los archivos

### 3. Variable de Entorno EAS: GOOGLE_SERVICES_JSON

**Archivo local**: `backend-zyra/google-services.json` existe con:
```json
{
  "project_id": "zyra-27954",
  "project_number": "1076677432632",
  "mobilesdk_app_id": "1:1076677432632:android:a06516f289be5c80b45dcd"
}
```

**Verificación requerida**:
- [ ] Confirmar que la variable `GOOGLE_SERVICES_JSON` en EAS Build Secrets contiene **exactamente** el contenido de este archivo
- [ ] Comando para verificar: `eas secret:list`
- [ ] Si la variable existe, comparar el hash del contenido con el archivo local

### 4. Último Build vs. Última Corrección

**Verificación pendiente**:
- [ ] Fecha del último build APK generado con `eas build`
- [ ] Fecha de cada corrección aplicada al código (commits de git)
- [ ] Comparar si el build incluye TODAS las correcciones previas

**Comando sugerido**:
```bash
eas build:list --platform android --limit 5
```

Comparar la fecha del build con:
```bash
git log --oneline --since="2026-09-01" -- src/services/pushNotificationService.js
```

---

## 🧪 Procedimiento de Verificación (APK Real)

### Fase 1: Verificar Token Registrado

1. **Instalar el APK en un dispositivo físico Android**
2. **Abrir la app y hacer login**
3. **Ejecutar en el backend**:
   ```sql
   SELECT id, usuario_id, push_token, plataforma, created_at 
   FROM dispositivos_push 
   WHERE usuario_id = [TU_USER_ID];
   ```

4. **Verificar**:
   - ✅ El token existe en la base de datos
   - ✅ El token comienza con `ExponentPushToken[...]`
   - ✅ La fecha `created_at` es reciente (después de tu login)

**Si el token NO está registrado**: El problema está en el frontend (registro de token fallando)  
**Si el token SÍ está registrado**: Continuar con Fase 2

### Fase 2: Enviar Push de Prueba Manual (con Verificación de Receipt)

Usar este script Node.js en el servidor backend:

```javascript
// test-push-with-receipt.js
const fetch = require('node-fetch');

const EXPO_PUSH_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';

async function testPushWithReceipt(token) {
  console.log('1️⃣ Enviando push notification...');
  
  // Paso 1: Enviar el push
  const sendResponse = await fetch(EXPO_PUSH_SEND, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{
      to: token,
      title: '🧪 Test Auditoría',
      body: 'Este es un push de prueba con verificación de receipt',
      sound: 'default',
      channelId: 'default',
    }]),
  });

  const sendData = await sendResponse.json();
  console.log('📤 Respuesta del envío:', JSON.stringify(sendData, null, 2));

  const ticket = sendData.data?.[0];
  if (!ticket) {
    console.error('❌ No se recibió ticket');
    return;
  }

  if (ticket.status === 'error') {
    console.error('❌ Error en ticket:', ticket.message, ticket.details);
    return;
  }

  const ticketId = ticket.id;
  console.log(`✅ Ticket recibido con ID: ${ticketId}`);
  console.log('⏳ Esperando 15 segundos antes de consultar receipt...');
  
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Paso 2: Verificar el receipt
  console.log('2️⃣ Consultando receipt real...');
  const receiptResponse = await fetch(EXPO_PUSH_RECEIPTS, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [ticketId] }),
  });

  const receiptData = await receiptResponse.json();
  console.log('📥 Respuesta del receipt:', JSON.stringify(receiptData, null, 2));

  const receipt = receiptData.data?.[ticketId];
  if (!receipt) {
    console.error('❌ No se encontró receipt para el ticket');
    return;
  }

  if (receipt.status === 'ok') {
    console.log('✅✅✅ ÉXITO CONFIRMADO: El push fue REALMENTE ENTREGADO');
  } else {
    console.error(`❌ FALLO CONFIRMADO: ${receipt.message}`, receipt.details);
  }
}

// Usar con: node test-push-with-receipt.js "ExponentPushToken[tu-token-aqui]"
const token = process.argv[2];
if (!token) {
  console.error('Uso: node test-push-with-receipt.js "ExponentPushToken[...]"');
  process.exit(1);
}

testPushWithReceipt(token).catch(console.error);
```

**Ejecutar**:
```bash
cd backend-zyra
node test-push-with-receipt.js "ExponentPushToken[tu-token-desde-bd]"
```

**Interpretación de resultados**:

| Resultado | Significado | Siguiente Paso |
|-----------|-------------|----------------|
| Ticket `status: 'error'` | El token es inválido o el projectId está mal configurado | Revisar configuración de Expo (Fase 3) |
| Ticket `status: 'ok'` pero Receipt no existe | Expo aún no procesó el push (muy raro después de 15s) | Esperar más tiempo y reintentar |
| Receipt `status: 'ok'` | 🎉 **El sistema SÍ funciona**, el problema está en otro lado | Revisar lógica de notificaciones en el código |
| Receipt `status: 'error'` con `DeviceNotRegistered` | El token expiró o el usuario desinstaló la app | Limpiar tokens antiguos de la BD |
| Receipt `status: 'error'` con `InvalidCredentials` | Las credenciales FCM en Expo están mal configuradas | Revisar configuración en dashboard de Expo (Fase 3) |

### Fase 3: Verificar Configuración en Dashboard de Expo

1. **Ir a**: https://expo.dev/accounts/modukabo/projects/appZyra/credentials
2. **Verificar Android FCM**:
   - [ ] Existe una credencial FCM configurada
   - [ ] El `Server Key` o `Service Account JSON` están configurados
   - [ ] El `package_name` coincide con `com.zyra.appzyra`

3. **Si no hay credenciales FCM configuradas**: Esta es la causa raíz
4. **Si hay credenciales**: Verificar que sean del proyecto correcto de Firebase

### Fase 4: Verificar Credenciales FCM en Firebase Console

1. **Ir a**: https://console.firebase.google.com/project/zyra-27954
2. **Navegar a**: Project Settings → Cloud Messaging
3. **Verificar**:
   - [ ] El proyecto está activo
   - [ ] Existe una `Server Key` (Legacy) o `Cloud Messaging API (V1)` habilitada
   - [ ] La API de Cloud Messaging está habilitada en Google Cloud Platform

---

## 🛠️ Solución Propuesta

### 1. Implementar Verificación de Receipts

Modificar `pushNotificationService.js` para:
1. Guardar los tickets en memoria/BD temporal
2. Esperar 15-30 segundos
3. Consultar los receipts reales
4. Limpiar tokens basándose en los receipts (no solo en los tickets)
5. Loggear claramente qué pushes fueron REALMENTE entregados

### 2. Crear Sistema de Monitoreo

Implementar una tabla `push_logs` que registre:
- `ticket_id`
- `receipt_status` (ok / error)
- `receipt_message` (en caso de error)
- `timestamp_sent`
- `timestamp_receipt_checked`

### 3. Dashboard de Diagnóstico

Endpoint en el backend que muestre:
- Último push enviado a cada usuario
- Estado del receipt (pendiente / ok / error)
- Tokens activos vs. tokens inválidos
- Tasa de entrega real (receipts ok / total enviados)

---

## 📊 Resumen de Evidencias

### ✅ Configuración Correcta

- [x] `projectId` consistente en `app.json`
- [x] `package_name` consistente entre `app.json` y `google-services.json`
- [x] Versión de `expo-notifications`: `~57.0.16`
- [x] Frontend correctamente configurado para obtener tokens
- [x] Backend recibe y almacena tokens correctamente

### ❌ Problemas Identificados

- [ ] **CRÍTICO**: Sistema de receipts NO implementado
- [ ] **Pendiente**: Verificar credenciales FCM en Expo Dashboard
- [ ] **Pendiente**: Verificar que el último build incluya todas las correcciones
- [ ] **Pendiente**: Verificar variable `GOOGLE_SERVICES_JSON` en EAS

### 🔍 Verificaciones Pendientes (Requieren Acceso a Dashboards)

- [ ] Dashboard de Expo → Credentials → FCM configurado correctamente
- [ ] Firebase Console → Cloud Messaging habilitado
- [ ] EAS Build Secrets → `GOOGLE_SERVICES_JSON` presente y actualizado
- [ ] Comparar fecha del último build vs. fecha de las correcciones

---

## 🎯 Próximos Pasos Inmediatos

1. **Ejecutar el script de prueba** (`test-push-with-receipt.js`) con un token real de la BD
2. **Basándose en el resultado**:
   - Si el receipt es `ok` → El problema está en la lógica de cuándo/cómo se envían las notificaciones
   - Si el receipt es `error` → Revisar configuración de Expo/Firebase
3. **Implementar el sistema de receipts** en el código de producción
4. **Verificar manualmente** los dashboards de Expo y Firebase

---

## 📝 Notas Finales

Esta auditoría confirma que el problema principal es la **falta de verificación de receipts**. Todo el sistema ha estado funcionando sobre la **falsa seguridad** de que un ticket con `status: 'ok'` significa entrega exitosa, cuando en realidad solo significa que Expo aceptó procesar la solicitud.

La implementación del sistema de receipts es **obligatoria** según la documentación oficial de Expo:
> "The ticket receipt will contain information about whether the notification was successfully delivered. **You must check the receipt** to verify delivery."

Ref: https://docs.expo.dev/push-notifications/sending-notifications/#individual-errors
