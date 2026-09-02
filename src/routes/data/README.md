# Guía Rápida - Uso de Archivos de Datos

Este directorio contiene archivos JSON listos para usar con los endpoints de Zyra.

## 📁 Archivos Disponibles

### Festivos
- **`festivos-colombia-2026.json`** - 19 festivos oficiales de Colombia para 2026

### Estrategias de Precios
- **`precios-estrategia-prime.json`** - Viernes-Sábado más caros
- **`precios-estrategia-happy-hour.json`** - Descuento en horarios de baja demanda
- **`precios-estrategia-simple.json`** - Precio único por día

---

## 🚀 Cómo Usar

### 1. Configurar Festivos del Año

```bash
# Desde la carpeta raíz del proyecto
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

**Resultado**: Se crearán 19 excepciones de calendario (festivos colombianos 2026).

---

### 2. Configurar Precios con Estrategia Prime

```bash
# Configurar precios en cancha ID 5
curl -X POST http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json
```

**Resultado**: 
- Lun-Jue: $60,000/h todo el día
- Viernes: $60k (día) / $100k (noche 18-23h)
- Sábado: $90k todo el día
- Domingo: $85k todo el día
- Festivos: $120k todo el día

---

### 3. Configurar Precios con Estrategia Happy Hour

```bash
# Configurar precios en cancha ID 7
curl -X POST http://localhost:3000/api/courts/7/precios \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-happy-hour.json
```

**Resultado**:
- Mañanas (8-12h): $40k-50k (descuento)
- Mediodía (12-18h): $65k-80k (estándar)
- Noche (18-22h): $85k-100k (premium)

---

### 4. Configurar Precios con Estrategia Simple

```bash
# Configurar precios en cancha ID 9
curl -X POST http://localhost:3000/api/courts/9/precios \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-simple.json
```

**Resultado**: Precio único por día de la semana (sin franjas horarias).

---

## 🔧 Personalización

### Modificar Festivos

Edita `festivos-colombia-2026.json`:

```json
{
  "fecha": "2026-03-15",
  "esta_abierto": false,        // true = abierto, false = cerrado
  "es_festivo": true,           // true = aplica precio tipo_dia:7
  "descripcion": "Mi Festivo"
}
```

### Modificar Precios

Edita cualquier archivo de estrategia:

```json
{
  "tipo_dia": 1,           // 0=Dom, 1=Lun ... 6=Sab, 7=Festivo
  "hora_inicio": "08:00",  // Formato 24h
  "hora_fin": "14:00",     // Formato 24h
  "precio_hora": 50000     // Precio en pesos colombianos
}
```

---

## 🧪 Testing Rápido

### Verificar Festivos Creados

```bash
curl http://localhost:3000/api/complexes/3/excepciones
```

### Verificar Precios Configurados

```bash
curl http://localhost:3000/api/courts/5/precios
```

### Consultar Festivo Específico

```bash
curl http://localhost:3000/api/complexes/3/excepciones/2026-07-20
```

---

## 💡 Tips

1. **IDs Dinámicos**: Reemplaza `3`, `5`, `7`, `9` con los IDs reales de tu base de datos.

2. **Token de Autenticación**: Obtén el token haciendo login:
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "tu@email.com", "password": "tupassword"}'
   ```

3. **Combinar Estrategias**: Puedes usar diferentes estrategias en diferentes canchas del mismo complejo.

4. **Actualizar Precios**: `POST` siempre reemplaza toda la configuración. Para modificar solo una franja, usa `PUT /api/courts/:id/precios/:precioId`.

5. **Festivos Anuales**: Ejecuta el bulk insert de festivos al inicio de cada año.

---

## 📊 Flujo Completo Recomendado

```bash
# 1. Crear complejo y canchas (ya implementado)
# 2. Configurar horarios del complejo
POST /api/complexes/3/horarios/estandar

# 3. Configurar festivos del año
POST /api/complexes/3/excepciones/bulk
  @festivos-colombia-2026.json

# 4. Configurar precios en cada cancha
POST /api/courts/5/precios
  @precios-estrategia-prime.json

POST /api/courts/6/precios
  @precios-estrategia-happy-hour.json

# 5. Verificar todo
GET /api/complexes/3/excepciones
GET /api/courts/5/precios
```

---

## 🔗 Referencias

- **Documentación Completa de Precios**: `../PRECIOS_CANCHA_EXAMPLES.md`
- **Documentación Completa de Excepciones**: `../EXCEPCIONES_CALENDARIO_EXAMPLES.md`
- **README General**: `../../README_PRECIOS_Y_EXCEPCIONES.md`
