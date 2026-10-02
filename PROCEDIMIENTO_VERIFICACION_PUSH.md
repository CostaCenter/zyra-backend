# 🧪 Procedimiento de Verificación del Sistema de Push Notifications

Este documento proporciona una guía paso a paso para verificar el funcionamiento completo del sistema de push notifications, con evidencia real de entrega.

---

## 📋 Pre-requisitos

- [ ] Acceso al backend con Node.js instalado
- [ ] Acceso a la base de datos PostgreSQL
- [ ] Un dispositivo Android físico con el APK instalado
- [ ] Credenciales de acceso a:
  - Dashboard de Expo (expo.dev)
  - Firebase Console (console.firebase.google.com)
  - EAS Build (para verificar secrets)

---

## Fase 1: Verificar Registro de Token en el Dispositivo

### 1.1. Instalar y Abrir la App

1. **Instalar el APK** en un dispositivo Android físico (no emulador)
2. **Abrir la app** y hacer login con un usuario conocido
3. **Anotar el `usuario_id`** del usuario con el que iniciaste sesión

### 1.2. Verificar Token en la Base de Datos

Ejecutar en PostgreSQL:

```sql
SELECT 
  id,
  usuario_id,
  push_token,
  plataforma,
  created_at,
  updated_at
FROM dispositivos_push 
WHERE usuario_id = [TU_USUARIO_ID]
ORDER BY created_at DESC;
```

**Verificaciones**:
- ✅ Debe existir AL MENOS UNA fila para tu usuario
- ✅ El campo `push_token` debe comenzar con `ExponentPushToken[`
- ✅ La fecha `created_at` debe ser reciente (después de tu login)
- ✅ El campo `plataforma` debe ser `android`

**Si NO existe el token**:
```
🔍 PROBLEMA: El frontend no está registrando tokens correctamente
📍 REVISAR:
   - pushNotifications.core.js → syncPushTokenWithBackend()
   - App.js → useEffect que llama a syncPushTokenWithBackend
   - Logs del frontend al abrir la app
   - Permisos de notificaciones en el dispositivo (Configuración → Apps → Zyra → Notificaciones)
```

**Si el token existe**: ✅ Continuar con Fase 2

### 1.3. Copiar el Token

```sql
-- Copiar el token completo para usarlo en las pruebas
SELECT push_token 
FROM dispositivos_push 
WHERE usuario_id = [TU_USUARIO_ID]
LIMIT 1;
```

Copiar el valor completo, ejemplo:
```
ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
```

---

## Fase 2: Prueba de Envío con Verificación de Receipt

### 2.1. Ejecutar el Script de Prueba

En el servidor backend:

```bash
cd backend-zyra
node scripts/test-push-with-receipt.mjs "ExponentPushToken[tu-token-copiado]"
```

### 2.2. Interpretación de Resultados

#### ✅ Caso 1: Ticket y Receipt OK

```
📤 RESPUESTA DEL ENVÍO:
{
  "data": [
    {
      "status": "ok",
      "id": "a1b2c3d4-..."
    }
  ]
}

📥 RESPUESTA DEL RECEIPT:
{
  "data": {
    "a1b2c3d4-...": {
      "status": "ok"
    }
  }
}

✅✅✅ ¡ÉXITO CONFIRMADO!
```

**Significado**: El sistema de push funciona perfectamente.  
**Siguiente paso**: El problema está en la lógica de negocio (cuándo/por qué se envían las notificaciones). Ir a **Fase 4**.

---

#### ❌ Caso 2: Ticket ERROR - DeviceNotRegistered

```
📤 RESPUESTA DEL ENVÍO:
{
  "data": [
    {
      "status": "error",
      "message": "\"ExponentPushToken[...]\" is not a registered push notification recipient",
      "details": {
        "error": "DeviceNotRegistered"
      }
    }
  ]
}
```

**Significado**: El token expiró o el dispositivo desinstaló/reinstaló la app.  
**Solución**:
1. Desinstalar completamente la app del dispositivo
2. Reinstalar el APK
3. Abrir la app y hacer login
4. Verificar que se registre un NUEVO token en la BD
5. Repetir la prueba con el nuevo token

---

#### ❌ Caso 3: Ticket ERROR - InvalidCredentials

```
📤 RESPUESTA DEL ENVÍO:
{
  "data": [
    {
      "status": "error",
      "message": "Invalid credentials",
      "details": {
        "error": "InvalidCredentials"
      }
    }
  ]
}
```

**Significado**: Las credenciales FCM en Expo están mal configuradas.  
**Solución**: Ir a **Fase 3** para revisar configuración de Expo/Firebase.

---

#### ❌ Caso 4: Ticket OK pero Receipt ERROR

```
📤 RESPUESTA DEL ENVÍO:
{
  "data": [{ "status": "ok", "id": "a1b2c3d4-..." }]
}

📥 RESPUESTA DEL RECEIPT:
{
  "data": {
    "a1b2c3d4-...": {
      "status": "error",
      "message": "The Android FCM server key you provided is invalid.",
      "details": {
        "error": "InvalidCredentials"
      }
    }
  }
}
```

**Significado**: Expo aceptó la solicitud, pero FCM rechazó la entrega.  
**Solución**: Ir a **Fase 3** para revisar configuración de Firebase/Expo.

---

## Fase 3: Verificar Configuración de Expo y Firebase

### 3.1. Verificar Project ID en Expo Dashboard

1. **Ir a**: https://expo.dev/accounts/modukabo/projects/appZyra
2. **Verificar que el proyecto existe** y no fue eliminado
3. **Copiar el Project ID** de la URL o del dashboard
4. **Comparar con `app.json`**:

```bash
cd appZyra
cat app.json | grep -A 2 "projectId"
```

Debe mostrar:
```json
"projectId": "10a95ae8-b28a-4ad3-910c-e33f95b09e00"
```

✅ Si coincide → Continuar  
❌ Si no coincide → Actualizar `app.json` con el ID correcto y reconstruir el APK

### 3.2. Verificar Credenciales FCM en Expo

1. **Ir a**: https://expo.dev/accounts/modukabo/projects/appZyra/credentials
2. **Seleccionar**: Android → Production
3. **Verificar**:
   - [ ] Existe una credencial "Google Service Account Key" o "FCM Server Key"
   - [ ] El `package_name` asociado es: `com.zyra.appzyra`
   - [ ] La credencial fue creada recientemente (no es muy antigua)

**Si no hay credenciales configuradas**:
```
🚨 CAUSA RAÍZ ENCONTRADA: Sin credenciales FCM
📍 SOLUCIÓN: Configurar credenciales FCM en Expo
```

Seguir: https://docs.expo.dev/push-notifications/fcm-credentials/

### 3.3. Verificar Firebase Project

1. **Ir a**: https://console.firebase.google.com/project/zyra-27954
2. **Navegar a**: ⚙️ Project Settings → Cloud Messaging

**Verificar**:
- [ ] La API de Cloud Messaging está **habilitada**
- [ ] Existe un "Server Key" (Legacy) o "Cloud Messaging API (V1)" configurado
- [ ] El `package_name` en "Your apps" incluye: `com.zyra.appzyra`

**Si Cloud Messaging API está deshabilitada**:
1. Ir a: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=zyra-27954
2. Hacer clic en "ENABLE"
3. Esperar 5-10 minutos y repetir la prueba

### 3.4. Verificar Variable de Entorno en EAS

```bash
cd appZyra
npx eas secret:list
```

**Buscar**: `GOOGLE_SERVICES_JSON`

**Verificaciones**:
- [ ] La variable existe
- [ ] El valor coincide con el contenido de `google-services.json`

**Para actualizar (si es necesario)**:
```bash
npx eas secret:delete --name GOOGLE_SERVICES_JSON
cat google-services.json | npx eas secret:create --name GOOGLE_SERVICES_JSON --value -
```

Después de actualizar, **reconstruir el APK**:
```bash
npm run build:preview:android
```

---

## Fase 4: Verificar Lógica de Notificaciones (Si el Sistema Funciona)

Si la Fase 2 confirmó que el push llega correctamente, pero en uso real las notificaciones no aparecen, el problema está en la **lógica de negocio**.

### 4.1. Verificar Condiciones de Envío

Revisar los servicios que envían notificaciones:

```bash
cd backend-zyra
grep -r "enviarPushNotificacionUsuario" src/services/
```

**Para cada resultado, verificar**:
- ¿La condición `if` está permitiendo que se envíe?
- ¿El `usuarioId` es correcto?
- ¿El campo `notificacion.mensaje` tiene contenido?

### 4.2. Activar Logs Detallados

Modificar temporalmente `pushNotificationService.js` para agregar más logs:

```javascript
export async function enviarPushNotificacionUsuario(usuarioId, { notificacion, navegacion }) {
  console.log('[Push] 🔍 INICIO enviarPushNotificacionUsuario', {
    usuarioId,
    notificacionId: notificacion?.id,
    mensaje: notificacion?.mensaje,
    tipo: notificacion?.tipo,
  });
  
  // ... resto del código
}
```

### 4.3. Monitorear Logs en Tiempo Real

```bash
cd backend-zyra
# Si usas PM2:
pm2 logs --lines 100

# Si usas nodemon:
# Los logs ya están en la consola

# Filtrar solo logs de push:
pm2 logs | grep '\[Push\]'
```

**Realizar una acción en la app que debería generar una notificación** (ej: crear un partido, enviar un mensaje) y observar los logs.

**Si NO aparece ningún log de `[Push]`**:
```
🔍 PROBLEMA: El código nunca llega a enviarPushNotificacionUsuario
📍 REVISAR: La lógica de negocio que debería disparar la notificación
```

**Si aparece el log pero dice "sin tokens registrados"**:
```
🔍 PROBLEMA: El usuario receptor no tiene tokens registrados
📍 VERIFICAR: Que el usuario receptor haya abierto la app al menos una vez
```

**Si aparece el log y envía el push**:
```
✅ El sistema está funcionando correctamente
🔍 VERIFICAR: Que el usuario receptor esté viendo las notificaciones en su dispositivo
```

---

## Fase 5: Verificar Recepción en el Dispositivo

### 5.1. Verificar Permisos de Notificaciones

En el dispositivo Android:
1. **Configuración** → **Apps** → **Zyra**
2. **Notificaciones**
3. Verificar que esté **activado**

### 5.2. Enviar Notificación de Prueba desde el Backend

Crear un script temporal en el backend:

```javascript
// test-notification-manual.mjs
import { enviarPushNotificacionUsuario } from './src/services/pushNotificationService.js';

const notificacion = {
  id: 99999,
  mensaje: '🧪 Prueba manual de notificación',
  tipo: 'TEST',
};

const navegacion = {
  destino: 'MainTabs',
  params: {},
};

const usuarioId = process.argv[2]; // Pasar como argumento

if (!usuarioId) {
  console.error('Uso: node test-notification-manual.mjs [USUARIO_ID]');
  process.exit(1);
}

console.log(`Enviando notificación de prueba a usuario ${usuarioId}...`);

enviarPushNotificacionUsuario(Number(usuarioId), { notificacion, navegacion })
  .then(() => {
    console.log('✅ Notificación enviada. Espera 15-30 segundos y verifica el dispositivo.');
  })
  .catch((error) => {
    console.error('❌ Error:', error);
  });
```

**Ejecutar**:
```bash
node test-notification-manual.mjs [TU_USUARIO_ID]
```

**Verificar**:
- [ ] La notificación aparece en el dispositivo después de ~15-30 segundos
- [ ] Al tocar la notificación, la app se abre
- [ ] Los logs del backend muestran "✅ Entrega confirmada"

---

## Fase 6: Verificar Build Actualizado

### 6.1. Listar Últimos Builds

```bash
cd appZyra
npx eas build:list --platform android --limit 5
```

**Copiar la fecha del último build**, ejemplo:
```
Build ID: abc123...
Created: 2026-09-15 14:30:00
```

### 6.2. Comparar con Fechas de Correcciones

```bash
git log --oneline --since="2026-09-01" -- src/services/pushNotificationService.js
```

**Verificar**:
- [ ] Todos los commits de correcciones son ANTERIORES al último build
- [ ] Si hay commits posteriores, el APK instalado NO incluye esas correcciones

**Si hay correcciones posteriores al build**:
```
⚠️  El APK instalado está desactualizado
📍 SOLUCIÓN: Generar un nuevo build
   npm run build:preview:android
```

---

## ✅ Checklist Final de Verificación

Usar esta lista para confirmar que TODO está funcionando:

### Configuración
- [ ] `projectId` en `app.json` es correcto
- [ ] `package_name` coincide en `app.json` y `google-services.json`
- [ ] Credenciales FCM configuradas en Expo Dashboard
- [ ] Cloud Messaging API habilitada en Firebase
- [ ] Variable `GOOGLE_SERVICES_JSON` en EAS es correcta
- [ ] El APK instalado incluye todas las correcciones

### Registro de Tokens
- [ ] Token registrado en la BD al abrir la app
- [ ] Token comienza con `ExponentPushToken[`
- [ ] Token es reciente (no expirado)

### Envío y Entrega
- [ ] Script de prueba `test-push-with-receipt.mjs` retorna Receipt OK
- [ ] Logs del backend muestran "✅ Entrega confirmada"
- [ ] Notificación aparece en el dispositivo físico

### Lógica de Negocio
- [ ] Logs muestran que `enviarPushNotificacionUsuario` es llamado
- [ ] El `usuarioId` receptor es correcto
- [ ] El `notificacion.mensaje` tiene contenido
- [ ] Las condiciones de envío se cumplen

---

## 📞 Soporte

Si después de seguir este procedimiento el sistema sigue sin funcionar:

1. **Documentar el resultado de cada fase** (copiar outputs de comandos)
2. **Anotar en qué fase falló**
3. **Incluir logs completos** del backend y frontend
4. **Tomar capturas** del Dashboard de Expo y Firebase Console

Con esta información, será posible diagnosticar el problema exacto.
