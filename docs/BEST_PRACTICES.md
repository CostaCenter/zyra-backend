# Mejores Prácticas y Consideraciones - Sistema de Búsqueda Zyra

## 🔒 Seguridad

### 1. SQL Injection Protection
✅ **Implementado**: Sequelize ORM previene SQL injection automáticamente
- Todos los parámetros son sanitizados por Sequelize
- Uso de operadores seguros (Op.iLike, Op.eq, etc.)

### 2. Rate Limiting (Pendiente de implementar)
```javascript
// Recomendación: Agregar rate limiting
import rateLimit from 'express-rate-limit';

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por IP
  message: 'Demasiadas búsquedas, intenta más tarde'
});

app.use('/api/explorar', searchLimiter, explorarRoutes);
```

### 3. Validación de Input
✅ **Implementado**:
- Validación de formato de fecha
- Validación de tipos numéricos
- Límites en paginación (max: 100)

### 4. CORS
✅ **Implementado**: CORS habilitado en app.js
- Considera restringir dominios en producción

---

## ⚡ Performance

### 1. Índices de Base de Datos (Recomendado)
```sql
-- Índices recomendados para optimizar búsqueda
CREATE INDEX idx_canchas_nombre ON canchas(nombre);
CREATE INDEX idx_canchas_state ON canchas(state);
CREATE INDEX idx_canchas_sport_id ON canchas(sport_id);
CREATE INDEX idx_complejos_nombre ON complejos(nombre);
CREATE INDEX idx_complejos_ubicacion ON complejos(ubicacion);
CREATE INDEX idx_sports_name ON sports(name);

-- Índices para búsqueda de texto (PostgreSQL)
CREATE INDEX idx_canchas_nombre_gin ON canchas USING gin(nombre gin_trgm_ops);
CREATE INDEX idx_complejos_nombre_gin ON complejos USING gin(nombre gin_trgm_ops);
```

### 2. Cache con Redis (Futuro)
```javascript
// Ejemplo de implementación con Redis
import redis from 'redis';

const client = redis.createClient();

export const searchCourtsWithCache = async (filters) => {
  const cacheKey = `search:${JSON.stringify(filters)}`;
  
  // Intentar obtener del cache
  const cached = await client.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Si no está en cache, buscar en BD
  const results = await searchCourts(filters);
  
  // Guardar en cache por 5 minutos
  await client.setEx(cacheKey, 300, JSON.stringify(results));
  
  return results;
};
```

### 3. Paginación
✅ **Implementado**: Siempre usar paginación para listas grandes
- Default: 10 resultados
- Máximo: 100 resultados
- Evita cargar miles de registros

### 4. Select Específico
✅ **Implementado**: Solo seleccionar campos necesarios
```javascript
attributes: ['id', 'nombre', 'ubicacion'] // No usar SELECT *
```

---

## 🎯 Mejores Prácticas de Búsqueda

### 1. Búsqueda de Texto
✅ **Implementado**: ILIKE para case-insensitive
```javascript
// Bien: case-insensitive
{ nombre: { [Op.iLike]: `%${q}%` } }

// Mal: case-sensitive
{ nombre: { [Op.like]: `%${q}%` } }
```

### 2. Wildcards
✅ **Implementado**: Búsqueda parcial con %
```javascript
// Permite: "sint" → "Sintética"
`%${q}%`
```

### 3. Filtros Combinados
✅ **Implementado**: Soporte para múltiples filtros
```javascript
// Usuario puede combinar: texto + deporte + ubicación
q=sintetica&deporte=futbol&ubicacion=Cali
```

---

## 📊 Monitoreo y Logging

### 1. Logging de Búsquedas (Recomendado)
```javascript
// Agregar analytics de búsquedas
export const buscarCanchas = async (req, res) => {
  const { q, deporte, ubicacion } = req.query;
  
  // Log para analytics
  console.log('[SEARCH]', {
    timestamp: new Date(),
    filters: { q, deporte, ubicacion },
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // ... resto del código
};
```

### 2. Métricas de Performance
```javascript
// Medir tiempo de respuesta
const start = Date.now();
const canchas = await searchCourts(filters);
const duration = Date.now() - start;

console.log(`[PERFORMANCE] Búsqueda completada en ${duration}ms`);
```

---

## 🧪 Testing

### 1. Tests Unitarios (Recomendado)
```javascript
// tests/services/searchService.test.js
import { searchCourts } from '../../src/services/searchService';

describe('searchService', () => {
  test('debe buscar por texto', async () => {
    const results = await searchCourts({ q: 'sintetica' });
    expect(results.length).toBeGreaterThan(0);
  });
  
  test('debe filtrar por deporte', async () => {
    const results = await searchCourts({ deporte: 'futbol' });
    results.forEach(cancha => {
      expect(cancha.sport.name).toContain('Fútbol');
    });
  });
});
```

### 2. Tests de Integración
```javascript
// tests/controllers/explorarController.test.js
import request from 'supertest';
import app from '../../src/app';

describe('GET /api/explorar/canchas', () => {
  test('debe retornar 200 y array de canchas', async () => {
    const response = await request(app)
      .get('/api/explorar/canchas')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
  
  test('debe validar formato de fecha', async () => {
    const response = await request(app)
      .get('/api/explorar/canchas?fecha=2024/01/15')
      .expect(400);
    
    expect(response.body.success).toBe(false);
  });
});
```

---

## 🔄 Versionado de API

### Recomendación para el futuro:
```javascript
// app.js
app.use('/api/v1/explorar', explorarRoutes);

// Cuando haya cambios breaking:
app.use('/api/v2/explorar', explorarRoutesV2);
```

---

## 📱 Optimizaciones para Mobile

### 1. Compresión de Respuestas
```javascript
// app.js
import compression from 'compression';

app.use(compression()); // Comprimir responses
```

### 2. Imágenes Optimizadas
```javascript
// En el modelo, considerar diferentes tamaños
{
  photo: 'url_original',
  photo_thumbnail: 'url_pequeña',
  photo_medium: 'url_mediana'
}
```

### 3. Límites Razonables para Mobile
```javascript
// Para mobile, menos resultados por página
const DEFAULT_MOBILE_LIMIT = 5;
const DEFAULT_WEB_LIMIT = 10;

const limit = req.headers['user-agent'].includes('Mobile') 
  ? DEFAULT_MOBILE_LIMIT 
  : DEFAULT_WEB_LIMIT;
```

---

## 🌐 Internacionalización (i18n)

### Preparación para múltiples idiomas:
```javascript
// Mensajes en diferentes idiomas
const messages = {
  es: {
    search_completed: 'Búsqueda completada exitosamente',
    no_results: 'No se encontraron canchas'
  },
  en: {
    search_completed: 'Search completed successfully',
    no_results: 'No courts found'
  }
};

// En el controlador
const lang = req.headers['accept-language'] || 'es';
res.json({
  message: messages[lang].search_completed
});
```

---

## 🔍 SEO y Compartir (Web)

### Open Graph Tags para compartir:
```javascript
// Endpoint para metadata
app.get('/api/explorar/canchas/:id/meta', async (req, res) => {
  const cancha = await getCourtById(req.params.id);
  
  res.json({
    title: cancha.nombre,
    description: `${cancha.tipo_deporte} en ${cancha.complejo.nombre}`,
    image: cancha.photo,
    url: `https://zyra.app/canchas/${cancha.id}`
  });
});
```

---

## 🚨 Manejo de Errores Avanzado

### Middleware de Error Global:
```javascript
// middlewares/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date()
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

// En app.js
app.use(errorHandler);
```

---

## 📈 Analytics y Tracking

### Eventos a trackear:
1. **Búsquedas más frecuentes**: ¿Qué buscan los usuarios?
2. **Filtros más usados**: Deporte, ubicación, etc.
3. **Búsquedas sin resultados**: Mejorar contenido
4. **Tiempo de respuesta**: Performance
5. **Conversiones**: Búsqueda → Reserva

```javascript
// Ejemplo con Google Analytics
import { track } from './analytics';

export const buscarCanchas = async (req, res) => {
  const { q, deporte } = req.query;
  
  // Track evento
  track('search', {
    search_term: q,
    sport: deporte,
    results_count: canchas.length
  });
  
  // ... resto del código
};
```

---

## 🔐 GDPR y Privacidad

### Consideraciones:
1. **No loguear datos personales** en búsquedas
2. **Anonimizar IPs** en logs
3. **Política de retención** de logs
4. **Consentimiento** para analytics

---

## ✅ Checklist de Producción

Antes de lanzar a producción:

- [ ] Índices de base de datos creados
- [ ] Rate limiting implementado
- [ ] CORS configurado para dominio específico
- [ ] Variables de entorno seguras
- [ ] Logging configurado (winston, morgan)
- [ ] Manejo de errores robusto
- [ ] Tests escritos y pasando
- [ ] Documentación actualizada
- [ ] Monitoreo configurado (Sentry, New Relic)
- [ ] SSL/HTTPS habilitado
- [ ] Backups automáticos de BD
- [ ] Health check endpoint
- [ ] Métricas de performance

---

## 🛠️ Herramientas Recomendadas

### Development:
- **Nodemon**: Auto-restart en desarrollo
- **ESLint**: Linting de código
- **Prettier**: Formateo consistente
- **Husky**: Git hooks

### Testing:
- **Jest**: Tests unitarios
- **Supertest**: Tests de API
- **Artillery**: Load testing

### Monitoring:
- **Sentry**: Error tracking
- **New Relic**: Performance monitoring
- **LogRocket**: Session replay

### Database:
- **pgAdmin**: PostgreSQL GUI
- **Postico**: Mac PostgreSQL client

---

## 📚 Recursos Adicionales

- [Sequelize Documentation](https://sequelize.org/)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [RESTful API Design](https://restfulapi.net/)

---

## 🎓 Aprendizajes Clave

1. **Siempre validar input del usuario**
2. **Usar paginación para listas grandes**
3. **Implementar caché para búsquedas frecuentes**
4. **Monitorear performance constantemente**
5. **Documentar exhaustivamente**
6. **Pensar en escalabilidad desde el inicio**

---

**Versión**: 1.0.0  
**Última actualización**: 2026-04-08  
**Mantenedor**: Equipo Backend Zyra
