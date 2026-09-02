# 🚀 Instalación: Sistema de Reservas Manuales

## 📋 Pasos de Instalación

### Paso 1: Ejecutar la Migración de Base de Datos

**Opción A: SQL Manual (Recomendado)**

Conecta a tu base de datos MySQL y ejecuta:

```sql
ALTER TABLE reservas 
ADD COLUMN origen_reserva VARCHAR(20) NOT NULL DEFAULT 'WEB' COMMENT 'Origen de la reserva: MANUAL, WEB, APP, API',
ADD COLUMN telefono_contacto VARCHAR(20) NULL COMMENT 'Teléfono de contacto para reservas manuales sin user_id',
ADD COLUMN nombre_contacto VARCHAR(100) NULL COMMENT 'Nombre de contacto para reservas manuales sin user_id';
```

**Opción B: Script de Migración Node.js**

```bash
cd backend-zyra
node src/migrations/agregar_origen_reserva.js
```

**Verificar la migración:**

```sql
DESCRIBE reservas;
```

Deberías ver las nuevas columnas:
```
origen_reserva      | varchar(20)  | NO   |     | WEB
telefono_contacto   | varchar(20)  | YES  |     | NULL
nombre_contacto     | varchar(100) | YES  |     | NULL
```

---

### Paso 2: Actualizar Reservas Existentes (Opcional)

Si quieres marcar el origen de reservas existentes:

```sql
-- Marcar reservas con user_id como WEB (creadas por clientes)
UPDATE reservas 
SET origen_reserva = 'WEB' 
WHERE user_id IS NOT NULL 
  AND origen_reserva = 'WEB';

-- Marcar reservas sin user_id como MANUAL
UPDATE reservas 
SET origen_reserva = 'MANUAL' 
WHERE user_id IS NULL 
  AND origen_reserva = 'WEB';
```

---

### Paso 3: Configurar el Frontend

Edita el archivo `dashboardZyra/src/componentes/principal/FormularioReservaManual.jsx`:

**Encuentra esta línea (aproximadamente línea 70):**

```javascript
// TODO: Obtener del contexto o props
const complejoId = 1;
```

**Opción A: Valor hardcodeado**
```javascript
const complejoId = 1; // Reemplaza con el ID real de tu complejo
```

**Opción B: Desde el contexto (recomendado)**
```javascript
const { complejoActual } = useComplejo(); // Asumiendo que tienes un contexto
const complejoId = complejoActual?.id || 1;
```

**Opción C: Desde props**
```javascript
export default function FormularioReservaManual({
  anchorRect,
  cancha,
  hora,
  fechaTexto,
  franjaHoraria,
  onCerrar,
  onConfirmar,
  complejoId, // Recibir como prop
}) {
  // ... resto del código
}
```

---

### Paso 4: Reiniciar el Backend

```bash
cd backend-zyra
npm run dev
# o
node src/app.js
```

---

### Paso 5: Reiniciar el Frontend

```bash
cd dashboardZyra
npm run dev
# o
npm start
```

---

## ✅ Verificación de Instalación

### 1. Verificar Backend

**Endpoint de historial de cliente:**

```bash
curl -X GET "http://localhost:5000/api/reservas/historial-cliente/3001234567?complejo_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "cliente": { ... },
  "estadisticas": { ... },
  "historial": [ ... ]
}
```

### 2. Verificar Frontend

1. Abre el dashboard en tu navegador
2. Navega a la agenda de reservas
3. Haz clic en una celda disponible (botón "+")
4. Escribe un número de teléfono con 10 dígitos
5. Debería aparecer el panel lateral con el historial

**Indicadores de funcionamiento:**
- ✅ Aparece "Buscando historial..." al escribir
- ✅ Se muestra el panel lateral después de 800ms
- ✅ El formulario no se mueve cuando aparece el historial
- ✅ Se pueden seleccionar 60 o 120 minutos de duración
- ✅ El botón "Agendar y Confirmar Reserva" funciona

### 3. Crear una Reserva de Prueba

1. Completa todos los campos:
   - Teléfono: +57 300 123 4567
   - Nombre: Cliente de Prueba
   - Duración: 60 minutos
   - Estado de pago: Abonó Anticipo
   - Método de pago: Efectivo

2. Haz clic en "Agendar y Confirmar Reserva"

3. Verifica en la base de datos:

```sql
SELECT 
  id,
  nombre_contacto,
  telefono_contacto,
  origen_reserva,
  estado_pago,
  duracion_minutos
FROM reservas 
WHERE origen_reserva = 'MANUAL'
ORDER BY creado_at DESC 
LIMIT 1;
```

**Resultado esperado:**
```
nombre_contacto: Cliente de Prueba
telefono_contacto: +57 300 123 4567
origen_reserva: MANUAL
estado_pago: ABONADA
duracion_minutos: 60
```

---

## 🐛 Solución de Problemas

### Problema 1: "Columna 'origen_reserva' no existe"

**Causa:** La migración no se ejecutó correctamente

**Solución:**
```sql
-- Verificar si existe
SHOW COLUMNS FROM reservas LIKE 'origen_reserva';

-- Si no existe, ejecutar manualmente
ALTER TABLE reservas 
ADD COLUMN origen_reserva VARCHAR(20) NOT NULL DEFAULT 'WEB';
```

### Problema 2: No aparece el panel de historial

**Causas posibles:**
1. El endpoint no está respondiendo
2. El token de autenticación es inválido
3. El complejo_id es incorrecto

**Solución:**
```javascript
// Abrir consola del navegador (F12)
// Buscar errores en la pestaña "Console"

// Verificar en la pestaña "Network":
// - Request URL debe ser: /api/reservas/historial-cliente/TELEFONO
// - Status debe ser: 200 OK
// - Response debe contener: success: true
```

### Problema 3: Error al crear reserva

**Causa:** Falta el campo origen_reserva en el payload

**Solución:**
Verificar que el FormularioReservaManual.jsx tenga:
```javascript
const payload = {
  // ... otros campos
  origen_reserva: 'MANUAL', // Esta línea es crucial
  telefono_contacto: telefono,
  nombre_contacto: nombre
};
```

### Problema 4: Error "complejo_id es obligatorio"

**Causa:** No se está enviando el complejo_id en la búsqueda

**Solución:**
```javascript
// En FormularioReservaManual.jsx, verificar:
const response = await axiosInstance.get(
  `/api/reservas/historial-cliente/${digits}`,
  {
    params: { complejo_id: complejoId }, // ✅ Debe estar aquí
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

---

## 📊 Consultas Útiles

### Ver todas las reservas manuales

```sql
SELECT 
  r.id,
  r.nombre_contacto,
  r.telefono_contacto,
  c.nombre AS cancha,
  r.fecha,
  r.hora_inicio,
  r.duracion_minutos,
  r.monto_total,
  r.estado_pago,
  r.origen_reserva,
  r.creado_at
FROM reservas r
INNER JOIN canchas c ON r.cancha_id = c.id
WHERE r.origen_reserva = 'MANUAL'
ORDER BY r.creado_at DESC;
```

### Estadísticas por origen

```sql
SELECT 
  origen_reserva,
  COUNT(*) as total,
  SUM(CASE WHEN estado_reserva = 'FINALIZADA' THEN 1 ELSE 0 END) as finalizadas,
  SUM(CASE WHEN estado_reserva = 'CANCELADA' THEN 1 ELSE 0 END) as canceladas,
  SUM(monto_total) as ingresos_totales
FROM reservas
GROUP BY origen_reserva;
```

### Clientes con más incumplimientos

```sql
SELECT 
  COALESCE(u.name, r.nombre_contacto) AS cliente,
  COALESCE(u.telefono, r.telefono_contacto) AS telefono,
  COUNT(*) as total_reservas,
  SUM(CASE WHEN r.estado_reserva = 'CANCELADA' THEN 1 ELSE 0 END) as canceladas,
  SUM(CASE WHEN r.estado_reserva = 'NO_SHOW' THEN 1 ELSE 0 END) as no_show,
  ROUND(
    (SUM(CASE WHEN r.estado_reserva = 'FINALIZADA' THEN 1 ELSE 0 END) * 100.0) / COUNT(*),
    2
  ) as tasa_cumplimiento
FROM reservas r
LEFT JOIN user u ON r.user_id = u.id
WHERE r.cancha_id IN (SELECT id FROM canchas WHERE complejo_id = 1)
GROUP BY cliente, telefono
HAVING (canceladas + no_show) > 0
ORDER BY (canceladas + no_show) DESC;
```

---

## 🎯 Testing

### Test Manual Completo

1. **Cliente Nuevo:**
   - [ ] Ingresar teléfono que NO existe en la BD
   - [ ] Verificar que NO aparece historial
   - [ ] Completar formulario y crear reserva
   - [ ] Verificar que se guardó con origen_reserva = 'MANUAL'

2. **Cliente Existente:**
   - [ ] Ingresar teléfono que SÍ existe
   - [ ] Verificar que aparece panel de historial
   - [ ] Verificar que el nombre se carga automáticamente
   - [ ] Ver estadísticas y tasa de cumplimiento

3. **Cliente con Incumplimientos:**
   - [ ] Crear reserva y cancelarla
   - [ ] Buscar el mismo teléfono nuevamente
   - [ ] Verificar que aparece alerta de incumplimiento
   - [ ] Verificar que el badge rojo está visible

4. **Duraciones:**
   - [ ] Crear reserva de 60 minutos
   - [ ] Verificar en BD: duracion_minutos = 60
   - [ ] Crear reserva de 120 minutos
   - [ ] Verificar en BD: duracion_minutos = 120

5. **Estados de Pago:**
   - [ ] Crear con "Abonó Anticipo"
   - [ ] Verificar: monto_abono = monto_total * 0.3
   - [ ] Crear con "Pago Total"
   - [ ] Verificar: monto_abono = monto_total
   - [ ] Crear con "Pendiente"
   - [ ] Verificar: monto_abono = 0

---

## 📚 Recursos Adicionales

- [FUNCIONALIDADES_RESERVAS_MANUALES.md](../dashboardZyra/FUNCIONALIDADES_RESERVAS_MANUALES.md) - Documentación completa de funcionalidades
- [MIGRACION_ORIGEN_RESERVA.md](./MIGRACION_ORIGEN_RESERVA.md) - Detalles técnicos de la migración
- Backend API: `src/controllers/reservaController.js`
- Frontend Component: `dashboardZyra/src/componentes/principal/FormularioReservaManual.jsx`
- Historial Component: `dashboardZyra/src/componentes/principal/HistorialCliente.jsx`

---

## ✅ Checklist de Instalación

- [ ] Migración de BD ejecutada correctamente
- [ ] Columnas verificadas en tabla reservas
- [ ] complejo_id configurado en FormularioReservaManual.jsx
- [ ] Backend reiniciado
- [ ] Frontend reiniciado
- [ ] Endpoint de historial probado con curl/Postman
- [ ] Panel de historial aparece al escribir teléfono
- [ ] Reserva de prueba creada exitosamente
- [ ] Reserva guardada con origen_reserva = 'MANUAL'
- [ ] Alertas de incumplimiento funcionan correctamente

---

**🎉 ¡Instalación completa! El sistema de reservas manuales está listo para usar.**

En caso de dudas o problemas, revisar la sección de Solución de Problemas o contactar al equipo de desarrollo.
