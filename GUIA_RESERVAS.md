# 📋 Guía completa para hacer reservas - API Zyra

## 🎯 Endpoint principal

```
POST /api/reservas
```

**🔐 Requiere autenticación obligatoria**

---

## 🚀 Paso a paso para reservar

### 1️⃣ Obtener token de usuario

```bash
curl -X POST "http://192.168.1.22:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@ejemplo.com",
    "password": "mi_password"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "name": "Juan Pérez" }
}
```

### 2️⃣ Buscar complejos disponibles (opcional)

```bash
curl "http://192.168.1.22:3000/api/explorar/complejos?fecha=2026-05-20&hora_inicio=10:00&deporte=Fútbol"
```

### 3️⃣ Ver disponibilidad de una cancha específica

```bash
curl "http://192.168.1.22:3000/api/reservas/disponibilidad/1?fecha=2026-05-20"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "cancha_id": 1,
    "fecha": "2026-05-20",
    "esta_abierto": true,
    "horarios_ocupados": [
      { "hora_inicio": "08:00:00", "hora_fin": "09:00:00" },
      { "hora_inicio": "14:00:00", "hora_fin": "15:30:00" }
    ]
  }
}
```

### 4️⃣ **HACER LA RESERVA** 🎯

```bash
curl -X POST "http://192.168.1.22:3000/api/reservas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "cancha_id": 1,
    "fecha": "2026-05-20",
    "hora_inicio": "10:00",
    "duracion_minutos": 60,
    "metodo_pago": "NEQUI"
  }'
```

---

## 📝 Parámetros del body

| Campo | Tipo | ¿Obligatorio? | Valores | Descripción |
|-------|------|---------------|---------|-------------|
| `cancha_id` | `number` | ✅ | ID válido | ID de la cancha a reservar |
| `fecha` | `string` | ✅ | `YYYY-MM-DD` | Fecha de la reserva |
| `hora_inicio` | `string` | ✅ | `HH:MM` | Hora de inicio (24h) |
| `duracion_minutos` | `number` | ❌ | `60`, `90`, `120` | Duración (default: 60) |
| `metodo_pago` | `string` | ❌ | `NEQUI`, `EFECTIVO`, `PAGOS_APP` | Método de pago del abono |

---

## ✅ Respuesta exitosa (201 Created)

```json
{
  "success": true,
  "message": "Reserva creada exitosamente",
  "data": {
    "id": 123,
    "cancha": "Cancha 1",
    "complejo": "Complejo Norte",
    "fecha": "2026-05-20",
    "hora_inicio": "10:00",
    "hora_fin": "11:00",
    "duracion_minutos": 60,
    "es_festivo": false,
    "precio_hora": 60000,
    "monto_total": 60000,
    "monto_abono": 18000,
    "saldo_pendiente": 42000,
    "metodo_pago": "NEQUI",
    "estado_pago": "ABONADA",
    "estado_reserva": "CONFIRMADA"
  }
}
```

### 💰 Explicación de los montos

- **`monto_total`**: 60,000 (precio total de la reserva)
- **`monto_abono`**: 18,000 (30% pagado al reservar)
- **`saldo_pendiente`**: 42,000 (70% que falta por pagar al llegar)

---

## ❌ Errores posibles

### 400 Bad Request
```json
{
  "success": false,
  "message": "cancha_id, fecha y hora_inicio son obligatorios"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Cancha no encontrada"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Esta cancha ya está reservada para ese horario"
}
```

---

## 📱 Ejemplos completos

### Ejemplo 1: Reserva básica de 1 hora

```bash
curl -X POST "http://192.168.1.22:3000/api/reservas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "cancha_id": 1,
    "fecha": "2026-05-20",
    "hora_inicio": "10:00"
  }'
```

### Ejemplo 2: Reserva de 90 minutos con método de pago

```bash
curl -X POST "http://192.168.1.22:3000/api/reservas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "cancha_id": 2,
    "fecha": "2026-05-21",
    "hora_inicio": "18:00",
    "duracion_minutos": 90,
    "metodo_pago": "NEQUI"
  }'
```

### Ejemplo 3: Reserva de 2 horas

```bash
curl -X POST "http://192.168.1.22:3000/api/reservas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "cancha_id": 3,
    "fecha": "2026-05-22",
    "hora_inicio": "16:00",
    "duracion_minutos": 120,
    "metodo_pago": "EFECTIVO"
  }'
```

---

## 🔄 Flujo completo recomendado

1. **Login** → Obtener token
2. **Buscar complejos** → Encontrar canchas disponibles
3. **Ver disponibilidad** → Verificar horarios libres
4. **Crear reserva** → Pagar 30% de abono
5. **Ir al complejo** → Jugar y pagar 70% restante

---

## 💡 Consejos importantes

### ✅ Buenas prácticas
- Siempre verificar disponibilidad antes de reservar
- Usar horarios válidos del complejo (06:00 - 23:00 típicamente)
- Reservar con al menos 1 hora de anticipación
- Guardar el ID de la reserva para futuras consultas

### ❌ Errores comunes
- No incluir el token de autorización
- Usar formatos incorrectos de fecha/hora
- Intentar reservar en horarios ya ocupados
- Reservar fuera del horario del complejo

---

## 🔍 Endpoints relacionados útiles

### Ver mis reservas
```bash
curl "http://192.168.1.22:3000/api/reservas/mis-reservas" \
  -H "Authorization: Bearer TU_TOKEN"
```

### Ver detalle de una reserva
```bash
curl "http://192.168.1.22:3000/api/reservas/123" \
  -H "Authorization: Bearer TU_TOKEN"
```

### Cancelar una reserva
```bash
curl -X PATCH "http://192.168.1.22:3000/api/reservas/123/cancelar" \
  -H "Authorization: Bearer TU_TOKEN"
```

---

## 📞 ¿Problemas?

Si tienes problemas con la API:

1. Verifica que el token sea válido
2. Confirma el formato de fecha/hora
3. Usa la disponibilidad antes de reservar
4. Revisa que la cancha exista y esté disponible

**¡Listo para reservar!** 🚀