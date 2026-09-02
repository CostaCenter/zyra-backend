# Comandos de Prueba Rápida - Sistema de Precios y Excepciones

Este archivo contiene comandos listos para copiar y pegar en la terminal para probar las funcionalidades implementadas.

## 🔑 Prerequisitos

1. **Servidor corriendo**: `npm run dev` en otra terminal
2. **Token de autenticación**: Obtener mediante login

### Obtener Token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tu@email.com", "password": "tupassword"}'
```

**Guarda el token que recibes en la respuesta**. Lo usaremos como `YOUR_TOKEN` en los siguientes comandos.

---

## 📊 PRECIOS DINÁMICOS DE CANCHAS

### 1. Configurar Precios - Estrategia Prime

```bash
curl -X POST http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "precios": [
      {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
      {"tipo_dia": 5, "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 60000},
      {"tipo_dia": 5, "hora_inicio": "18:00", "hora_fin": "23:00", "precio_hora": 100000},
      {"tipo_dia": 6, "hora_inicio": "09:00", "hora_fin": "23:00", "precio_hora": 90000},
      {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 120000}
    ]
  }'
```

### 2. Consultar Precios Configurados

```bash
curl http://localhost:3000/api/courts/5/precios
```

### 3. Actualizar una Franja de Precio

```bash
# Primero obtén el ID de la franja con el comando anterior
# Luego actualiza (reemplaza 46 con el ID real)

curl -X PUT http://localhost:3000/api/courts/5/precios/46 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"precio_hora": 95000}'
```

### 4. Eliminar una Franja de Precio

```bash
curl -X DELETE http://localhost:3000/api/courts/5/precios/46 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Eliminar Todos los Precios Dinámicos

```bash
curl -X DELETE http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Usar Archivo de Estrategia Predefinida

```bash
# Desde la raíz del proyecto
curl -X POST http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json
```

---

## 📅 EXCEPCIONES DE CALENDARIO

### 1. Agregar un Festivo

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia de Colombia"
  }'
```

### 2. Agregar Cierre por Mantenimiento

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-08-15",
    "esta_abierto": false,
    "es_festivo": false,
    "descripcion": "Mantenimiento general de canchas"
  }'
```

### 3. Agregar Todos los Festivos de Colombia 2026 (Bulk)

```bash
# Desde la raíz del proyecto
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

### 4. Consultar Todas las Excepciones

```bash
curl http://localhost:3000/api/complexes/3/excepciones
```

### 5. Consultar Excepciones Entre Fechas

```bash
curl "http://localhost:3000/api/complexes/3/excepciones?desde=2026-06-01&hasta=2026-08-31"
```

### 6. Consultar Solo Festivos

```bash
curl "http://localhost:3000/api/complexes/3/excepciones?solo_festivos=true"
```

### 7. Consultar Solo Días Cerrados

```bash
curl "http://localhost:3000/api/complexes/3/excepciones?solo_cerrados=true"
```

### 8. Consultar Fecha Específica

```bash
curl http://localhost:3000/api/complexes/3/excepciones/2026-07-20
```

### 9. Actualizar Excepción

```bash
curl -X PUT http://localhost:3000/api/complexes/3/excepciones/2026-07-20 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "descripcion": "Independencia de Colombia 🇨🇴",
    "esta_abierto": true
  }'
```

### 10. Eliminar Excepción

```bash
curl -X DELETE http://localhost:3000/api/complexes/3/excepciones/2026-07-20 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔄 FLUJO COMPLETO DE CONFIGURACIÓN

### Paso 1: Configurar Horarios del Complejo

```bash
curl -X POST http://localhost:3000/api/complexes/3/horarios/estandar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lunes_viernes": {"hora_apertura": "08:00", "hora_cierre": "22:00"},
    "sabado": {"hora_apertura": "09:00", "hora_cierre": "23:00"},
    "domingo": {"hora_apertura": "10:00", "hora_cierre": "20:00"}
  }'
```

### Paso 2: Configurar Festivos del Año

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

### Paso 3: Configurar Precios de la Cancha 5

```bash
curl -X POST http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json
```

### Paso 4: Configurar Precios de la Cancha 6

```bash
curl -X POST http://localhost:3000/api/courts/6/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-happy-hour.json
```

### Paso 5: Verificar Todo

```bash
# Ver horarios del complejo
curl http://localhost:3000/api/complexes/3/horarios

# Ver excepciones (festivos)
curl http://localhost:3000/api/complexes/3/excepciones

# Ver precios cancha 5
curl http://localhost:3000/api/courts/5/precios

# Ver precios cancha 6
curl http://localhost:3000/api/courts/6/precios
```

---

## 🧪 CASOS DE PRUEBA

### Escenario 1: Configurar Complejo Nuevo

```bash
# 1. Horarios estándar
curl -X POST http://localhost:3000/api/complexes/10/horarios/estandar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lunes_viernes": {"hora_apertura": "08:00", "hora_cierre": "22:00"},
    "sabado": {"hora_apertura": "09:00", "hora_cierre": "23:00"},
    "domingo": {"hora_apertura": "10:00", "hora_cierre": "20:00"}
  }'

# 2. Festivos
curl -X POST http://localhost:3000/api/complexes/10/excepciones/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json

# 3. Precios cancha principal
curl -X POST http://localhost:3000/api/courts/15/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json
```

### Escenario 2: Cambio de Estrategia de Precios

```bash
# Borrar precios actuales
curl -X DELETE http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN"

# Aplicar nueva estrategia
curl -X POST http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-simple.json
```

### Escenario 3: Mantenimiento de una Semana

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "excepciones": [
      {"fecha": "2026-08-10", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 1"},
      {"fecha": "2026-08-11", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 2"},
      {"fecha": "2026-08-12", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 3"},
      {"fecha": "2026-08-13", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 4"},
      {"fecha": "2026-08-14", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 5"}
    ]
  }'
```

---

## 📱 ENDPOINTS PÚBLICOS (Sin Token)

### Consultar Precios de Cancha

```bash
curl http://localhost:3000/api/courts/5/precios
```

### Consultar Horarios de Complejo

```bash
curl http://localhost:3000/api/complexes/3/horarios
```

### Consultar Excepciones de Complejo

```bash
curl http://localhost:3000/api/complexes/3/excepciones
```

### Verificar si una Fecha es Festivo

```bash
curl http://localhost:3000/api/complexes/3/excepciones/2026-07-20
```

---

## 🔧 TROUBLESHOOTING

### Error 404: Cancha/Complejo no encontrado

```bash
# Verifica que el ID existe
curl http://localhost:3000/api/courts/5
curl http://localhost:3000/api/complexes/3
```

### Error 403: Sin permisos

```bash
# Verifica tu token
curl http://localhost:3000/api/complexes/my-complexes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver Complejos del Usuario

```bash
curl http://localhost:3000/api/complexes/my-complexes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver Canchas de un Complejo

```bash
curl http://localhost:3000/api/courts/complex/3
```

---

## 💡 Tips

1. **Reemplaza los IDs**: Cambia `3`, `5`, `6`, etc. por los IDs reales de tu base de datos.

2. **Token**: Reemplaza `YOUR_TOKEN` con el token JWT obtenido del login.

3. **Windows PowerShell**: Si usas PowerShell, escapa las comillas dobles:
   ```powershell
   curl -X POST http://localhost:3000/api/courts/5/precios `
     -H "Authorization: Bearer YOUR_TOKEN" `
     -H "Content-Type: application/json" `
     -d '{\"precios\": [...]}'
   ```

4. **Postman/Insomnia**: Importa estos comandos como colecciones para facilitar las pruebas.

5. **Logs**: Revisa la consola del servidor para ver los errores detallados.

---

## 📚 Documentación Completa

- **Precios de Canchas**: `src/routes/PRECIOS_CANCHA_EXAMPLES.md`
- **Excepciones de Calendario**: `src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md`
- **README General**: `README_PRECIOS_Y_EXCEPCIONES.md`
- **Guía de Datos**: `src/routes/data/README.md`
