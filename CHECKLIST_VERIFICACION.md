# ✅ Checklist de Acciones Inmediatas

**Prioridad**: 🔴 ALTA  
**Tiempo estimado**: 30-45 minutos

---

## 🎯 Objetivo

Verificar cada eslabón del sistema de push notifications con **evidencia real de entrega**, no asumiendo que "status: ok" significa éxito.

---

## Fase 1: Verificación Automática de Configuración

### ☐ 1.1. Ejecutar verificación de configuración

```bash
cd C:\Users\WINDOWS 11\Desktop\desarrollo\zyra\backend-zyra
node scripts/verificar-config-push.mjs
```

**Resultado esperado**: 
- ✅ Todos los checks deben ser positivos
- Si hay errores, corregirlos antes de continuar

**Si aparecen errores**:
- Revisar `app.json`, `google-services.json`, `eas.json`
- Verificar que todos los `package_name` y `projectId` coincidan
- Corregir y volver a ejecutar el script

---

## Fase 2: Verificación de Credenciales en Dashboards

### ☐ 2.1. Verificar Expo Dashboard

1. **Ir a**: https://expo.dev/accounts/modukabo/projects/appZyra/credentials
2. **Verificar**:
   - [ ] El proyecto existe y es accesible
   - [ ] Seleccionar: **Android** → **Production**
   - [ ] Debe existir una credencial **"Google Service Account Key"** o **"FCM Server Key"**
   - [ ] El `package_name` debe ser: `com.zyra.appzyra`

**Si NO existe credencial FCM**:
```
🚨 CAUSA RAÍZ CONFIRMADA: Sin credenciales FCM configuradas
📋 SEGUIR: https://docs.expo.dev/push-notifications/fcm-credentials/
```

### ☐ 2.2. Verificar Firebase Console

1. **Ir a**: https://console.firebase.google.com/project/zyra-27954/settings/cloudmessaging
2. **Verificar**:
   - [ ] El proyecto está activo
   - [ ] Cloud Messaging API está **habilitada**
   - [ ] Existe un "Server Key" (Legacy) O "Cloud Messaging API (V1)" configurado
   - [ ] En "Your apps" aparece: `com.zyra.appzyra`

**Si Cloud Messaging API está deshabilitada**:
1. Ir a: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=zyra-27954
2. Clic en "ENABLE"
3. Esperar 5 minutos

### ☐ 2.3. Verificar EAS Secrets

```bash
cd C:\Users\WINDOWS 11\Desktop\desarrollo\zyra\appZyra
npx eas secret:list
```

**Verificar**:
- [ ] Existe la variable `GOOGLE_SERVICES_JSON`
- [ ] No está marcada como "missing" o "invalid"

**Si falta o es incorrecta**:
```bash
# Eliminar la antigua (si existe)
npx eas secret:delete --name GOOGLE_SERVICES_JSON

# Crear nueva desde el archivo local
type google-services.json | npx eas secret:create --name GOOGLE_SERVICES_JSON --value -
```

---

## Fase 3: Prueba de Entrega con Token Real

### ☐ 3.1. Obtener un token de la base de datos

**Conectar a PostgreSQL y ejecutar**:
```sql
SELECT 
  usuario_id,
  push_token,
  plataforma,
  created_at
FROM dispositivos_push 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;
```

**Anotar**:
- `usuario_id`: _________________
- `push_token`: _________________

**Si NO hay tokens registrados**:
1. Abrir la app en un dispositivo Android físico
2. Hacer login
3. Esperar 5 segundos
4. Repetir la consulta SQL
5. Debe aparecer el token

### ☐ 3.2. Ejecutar prueba de entrega con receipt

```bash
cd C:\Users\WINDOWS 11\Desktop\desarrollo\zyra\backend-zyra
node scripts/test-push-with-receipt.mjs "ExponentPushToken[...]"
```

*Reemplazar `ExponentPushToken[...]` con el token copiado*

### ☐ 3.3. Interpretar resultado

#### Caso A: ✅ Receipt `status: "ok"`
```
✅✅✅ ¡ÉXITO CONFIRMADO!
El push notification fue REALMENTE ENTREGADO al dispositivo.
```

**Conclusión**: El sistema de push funciona correctamente.  
**Siguiente paso**: Ir a **Fase 4** (verificar lógica de notificaciones)

#### Caso B: ❌ Receipt `error: "InvalidCredentials"`
```
❌ FALLO CONFIRMADO
Error: InvalidCredentials
```

**Conclusión**: Las credenciales FCM están mal configuradas.  
**Siguiente paso**: 
1. Revisar Expo Dashboard → Credentials
2. Verificar Firebase Console → Cloud Messaging
3. Regenerar credenciales si es necesario

#### Caso C: ❌ Ticket `status: "error"`
```
❌ ERROR EN EL TICKET:
Mensaje: "ExponentPushToken[...]" is not a registered push notification recipient
```

**Conclusión**: El token expiró o el dispositivo desinstaló la app.  
**Siguiente paso**:
1. Reinstalar la app en el dispositivo
2. Hacer login para registrar un nuevo token
3. Repetir la prueba con el nuevo token

---

## Fase 4: Prueba End-to-End (Si Fase 3 fue exitosa)

### ☐ 4.1. Ejecutar prueba end-to-end

```bash
cd C:\Users\WINDOWS 11\Desktop\desarrollo\zyra\backend-zyra
node scripts/test-push-end-to-end.mjs [USUARIO_ID]
```

*Reemplazar `[USUARIO_ID]` con el ID del usuario que tiene el token*

**Esta prueba**:
1. Crea una notificación en la BD
2. Envía el push al dispositivo
3. Espera 15 segundos
4. Verifica el receipt real
5. Muestra el resultado

### ☐ 4.2. Verificar en el dispositivo

**Inmediatamente después de ejecutar el script**:
- [ ] Apareció una notificación en el dispositivo (~15-30 segundos)
- [ ] El texto dice: "🧪 Prueba de push notification - [hora]"
- [ ] Al tocar la notificación, la app se abre
- [ ] En la pestaña de notificaciones de la app aparece la notificación

**Si el receipt fue OK pero NO aparece en el dispositivo**:
```
🔍 REVISAR:
   1. Configuración → Apps → Zyra → Notificaciones (debe estar activo)
   2. Que la app esté en primer plano o en segundo plano (no forzar cierre)
   3. Que el dispositivo tenga conexión a internet
```

---

## Fase 5: Verificar Build Actualizado (Si aplica)

### ☐ 5.1. Verificar último build

```bash
cd C:\Users\WINDOWS 11\Desktop\desarrollo\zyra\appZyra
npx eas build:list --platform android --limit 5
```

**Anotar la fecha del último build**: _________________

### ☐ 5.2. Comparar con fecha de correcciones

```bash
git log --oneline --since="2026-09-01" -- ../backend-zyra/src/services/pushNotificationService.js
```

**Verificar**:
- [ ] Todos los commits son ANTERIORES al último build
- [ ] Si hay commits posteriores, generar un nuevo build

### ☐ 5.3. Generar nuevo build (si es necesario)

```bash
cd C:\Users\WINDOWS 11\Desktop\desarrollo\zyra\appZyra
npm run build:preview:android
```

**Esperar a que el build termine** (~15-20 minutos)

Cuando esté listo:
1. Descargar el APK
2. Instalarlo en el dispositivo
3. Repetir las pruebas de Fase 3 y 4

---

## 📊 Registro de Resultados

Completar esta tabla con los resultados de cada fase:

| Fase | Resultado | Notas |
|------|-----------|-------|
| 1. Verificación de config | ☐ OK / ☐ ERROR | |
| 2.1. Expo Dashboard | ☐ OK / ☐ ERROR | |
| 2.2. Firebase Console | ☐ OK / ☐ ERROR | |
| 2.3. EAS Secrets | ☐ OK / ☐ ERROR | |
| 3. Prueba con receipt | ☐ OK / ☐ ERROR | |
| 4. Prueba end-to-end | ☐ OK / ☐ ERROR | |
| 5. Build actualizado | ☐ OK / ☐ NO APLICA | |

---

## 🎯 Conclusión Final

Después de completar todas las fases, el resultado debería ser uno de estos:

### ✅ Escenario A: Todo OK
- Configuración correcta ✅
- Receipt confirma entrega ✅
- Notificación aparece en dispositivo ✅

**Conclusión**: El sistema funciona perfectamente. Si en uso real las notificaciones no llegan, el problema está en la **lógica de negocio** (cuándo/por qué se envían).

**Siguiente paso**: Revisar los servicios que llaman a `enviarPushNotificacionUsuario` para verificar que las condiciones se cumplan.

### ❌ Escenario B: Problema de configuración
- Receipt retorna `InvalidCredentials` ❌
- O ticket retorna error de proyecto ❌

**Conclusión**: Las credenciales FCM están mal configuradas o el projectId es incorrecto.

**Siguiente paso**: Regenerar credenciales FCM en Expo Dashboard siguiendo la documentación oficial.

### ⚠️ Escenario C: Token inválido
- Ticket retorna `DeviceNotRegistered` ⚠️

**Conclusión**: El token expiró o el usuario desinstaló la app.

**Siguiente paso**: Reinstalar la app, registrar un nuevo token, y repetir las pruebas.

---

## 📞 Soporte Adicional

Si después de completar todas las fases el problema persiste:

1. **Documentar el resultado de cada fase** en la tabla de arriba
2. **Guardar los logs** de cada comando ejecutado
3. **Tomar capturas** de los dashboards de Expo y Firebase
4. **Compilar todo** para análisis posterior

Con esta información completa será posible identificar el problema exacto.
