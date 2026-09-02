# ⚡ Referencia Rápida - Gestión de Canchas

## 📌 Comandos Esenciales

### Variables de Entorno
```bash
export TOKEN="tu_token_jwt_aqui"
export COMPLEJO_ID=3
export CANCHA_ID=8
```

---

## 🏟️ CREAR CANCHA

```bash
curl -X POST http://localhost:3000/api/courts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "complejo_id": 3,
    "nombre": "Cancha Fútbol 5 - Principal",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": 50000,
    "state": "DISPONIBLE"
  }'
```

**Campos obligatorios:** `complejo_id`, `nombre`  
**Estados válidos:** DISPONIBLE | OCUPADA | MANTENIMIENTO | FUERA DE SERVICIO

---

## 📋 LISTAR CANCHAS

### Todas las canchas de un complejo
```bash
curl http://localhost:3000/api/courts/complex/3
```

### Cancha específica por ID
```bash
curl http://localhost:3000/api/courts/8
```

---

## ✏️ ACTUALIZAR CANCHA

```bash
curl -X PUT http://localhost:3000/api/courts/8 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Cancha VIP",
    "precio_hora": 60000,
    "state": "MANTENIMIENTO"
  }'
```

Todos los campos son opcionales. Solo envía los que quieres cambiar.

---

## 🗑️ ELIMINAR CANCHA

```bash
curl -X DELETE http://localhost:3000/api/courts/8 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 💰 PRECIOS DINÁMICOS

### Configurar precios (Estrategia Premium)

```bash
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
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

**tipo_dia:**
- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=FESTIVO

### Usar archivo predefinido

```bash
# Estrategia Premium
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json

# Estrategia Happy Hour
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-happy-hour.json

# Estrategia Simple
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-simple.json
```

### Consultar precios configurados

```bash
curl http://localhost:3000/api/courts/8/precios
```

### Actualizar una franja específica

```bash
# Primero obtén el ID de la franja con el comando anterior
curl -X PUT http://localhost:3000/api/courts/8/precios/46 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"precio_hora": 95000}'
```

### Eliminar una franja

```bash
curl -X DELETE http://localhost:3000/api/courts/8/precios/46 \
  -H "Authorization: Bearer $TOKEN"
```

### Eliminar todos los precios dinámicos

```bash
curl -X DELETE http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📅 EXCEPCIONES DE CALENDARIO

### Agregar un festivo

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia de Colombia"
  }'
```

### Agregar cierre por mantenimiento

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-08-15",
    "esta_abierto": false,
    "es_festivo": false,
    "descripcion": "Mantenimiento general"
  }'
```

### Importar festivos de Colombia 2026 (19 festivos)

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

### Listar excepciones

```bash
# Todas
curl http://localhost:3000/api/complexes/3/excepciones

# Entre fechas
curl "http://localhost:3000/api/complexes/3/excepciones?desde=2026-06-01&hasta=2026-08-31"

# Solo festivos
curl "http://localhost:3000/api/complexes/3/excepciones?solo_festivos=true"

# Solo días cerrados
curl "http://localhost:3000/api/complexes/3/excepciones?solo_cerrados=true"
```

### Consultar fecha específica

```bash
curl http://localhost:3000/api/complexes/3/excepciones/2026-07-20
```

### Actualizar excepción

```bash
curl -X PUT http://localhost:3000/api/complexes/3/excepciones/2026-07-20 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "descripcion": "Independencia de Colombia 🇨🇴"
  }'
```

### Eliminar excepción

```bash
curl -X DELETE http://localhost:3000/api/complexes/3/excepciones/2026-07-20 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🚀 CONFIGURACIÓN COMPLETA (Desde Cero)

### 1. Crear cancha
```bash
curl -X POST http://localhost:3000/api/courts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "complejo_id": 10,
    "nombre": "Cancha Principal",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": 50000,
    "state": "DISPONIBLE"
  }'
```

### 2. Importar festivos
```bash
curl -X POST http://localhost:3000/api/complexes/10/excepciones/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

### 3. Configurar precios dinámicos
```bash
curl -X POST http://localhost:3000/api/courts/15/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json
```

### 4. Verificar todo
```bash
# Ver cancha
curl http://localhost:3000/api/courts/15

# Ver precios
curl http://localhost:3000/api/courts/15/precios

# Ver excepciones
curl http://localhost:3000/api/complexes/10/excepciones
```

---

## 🔑 OBTENER TOKEN

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tu@email.com", "password": "tupassword"}'
```

Guarda el token que recibes y úsalo en la variable `$TOKEN`.

---

## 🆘 TROUBLESHOOTING

### Ver mis complejos
```bash
curl http://localhost:3000/api/complexes/my-complexes \
  -H "Authorization: Bearer $TOKEN"
```

### Ver canchas de un complejo
```bash
curl http://localhost:3000/api/courts/complex/3
```

### Verificar que existe un complejo
```bash
curl http://localhost:3000/api/complexes/3
```

### Verificar que existe una cancha
```bash
curl http://localhost:3000/api/courts/8
```

---

## 📊 ESTRATEGIAS PREDEFINIDAS

### 1. Estrategia Prime
- Lun-Jue: $60,000 todo el día
- Viernes: $60,000 hasta 18h, luego $100,000
- Sábado: $90,000 todo el día
- Festivos: $120,000 todo el día

**Archivo:** `src/routes/data/precios-estrategia-prime.json`

### 2. Estrategia Happy Hour
- Descuentos en horarios de baja demanda
- Incentiva reservas en horas valle
- 21 configuraciones de precios

**Archivo:** `src/routes/data/precios-estrategia-happy-hour.json`

### 3. Estrategia Simple
- Precio único por día
- Más caro fin de semana
- Fácil de entender

**Archivo:** `src/routes/data/precios-estrategia-simple.json`

---

## 💡 TIPS

### PowerShell (Windows)
Si usas PowerShell, escapa las comillas dobles:
```powershell
curl -X POST http://localhost:3000/api/courts `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"complejo_id\": 3, \"nombre\": \"Cancha 1\"}'
```

### Variables de entorno
```bash
# Guardar token
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Usar en comandos
curl -H "Authorization: Bearer $TOKEN" ...
```

### Archivos JSON
Los archivos predefinidos están en:
```
backend-zyra/src/routes/data/
├── festivos-colombia-2026.json
├── precios-estrategia-prime.json
├── precios-estrategia-happy-hour.json
└── precios-estrategia-simple.json
```

---

## 📚 DOCUMENTACIÓN COMPLETA

Para más detalles, consulta:
- `GUIA_CONFIGURACION_CANCHAS.md` - Guía completa con ejemplos
- `COMANDOS_PRUEBA.md` - 30+ comandos de prueba
- `COURTS_README.md` - Documentación CRUD de canchas
- `src/routes/PRECIOS_CANCHA_EXAMPLES.md` - 15 páginas sobre precios
- `src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md` - 20 páginas sobre excepciones

---

**Última actualización:** 17 de Abril, 2026  
**Sistema:** Zyra Backend v1.0
