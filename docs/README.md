# 📚 Documentación Backend Zyra

Bienvenido a la documentación completa del backend de Zyra. Esta carpeta contiene toda la información necesaria para entender, usar y mantener la API.

---

## 📖 Índice de Documentación

### 🔍 Sistema de Búsqueda y Exploración

#### 1. **[RESUMEN_EXPLORACION.md](./RESUMEN_EXPLORACION.md)** ⭐ EMPEZAR AQUÍ
**Descripción**: Overview completo del sistema de búsqueda implementado  
**Contenido**:
- Arquitectura del sistema
- Componentes creados (servicios, controladores, rutas)
- Características principales
- Ejemplos de uso
- Estado del proyecto

**Cuándo leerlo**: Primero, para entender qué se construyó

---

#### 2. **[API_EXPLORACION.md](./API_EXPLORACION.md)** 📘 REFERENCIA API
**Descripción**: Documentación técnica completa de la API de exploración  
**Contenido**:
- Todos los endpoints disponibles
- Parámetros de cada endpoint
- Ejemplos de request/response
- Casos de uso comunes
- Características técnicas

**Cuándo leerlo**: Para implementar/consumir la API

---

#### 3. **[API_EXPLORACION_TESTS.http](./API_EXPLORACION_TESTS.http)** 🧪 TESTING
**Descripción**: Colección de tests y ejemplos de peticiones HTTP  
**Contenido**:
- Ejemplos de búsquedas básicas
- Búsquedas combinadas
- Paginación
- Estadísticas
- Tests de validación
- Ejemplos con cURL

**Cuándo usarlo**: Para probar los endpoints (Thunder Client, Postman, etc.)

---

#### 4. **[FRONTEND_INTEGRATION_EXAMPLES.js](./FRONTEND_INTEGRATION_EXAMPLES.js)** 📱 FRONTEND
**Descripción**: Guía de integración con React Native  
**Contenido**:
- Services para consumir la API
- Redux Slice completo
- Componentes de ejemplo
- Hooks personalizados
- Paginación infinita
- Debounce en búsqueda

**Cuándo usarlo**: Para integrar la API en la app móvil

---

#### 5. **[BEST_PRACTICES.md](./BEST_PRACTICES.md)** 🛡️ BUENAS PRÁCTICAS
**Descripción**: Mejores prácticas, seguridad y optimizaciones  
**Contenido**:
- Seguridad (SQL injection, rate limiting, CORS)
- Performance (índices, cache, paginación)
- Monitoreo y logging
- Testing
- Optimizaciones mobile
- Checklist de producción

**Cuándo leerlo**: Antes de deployar a producción y para mantenimiento

---

### ⏰ Sistema de Horarios y Precios

#### 6. **[HORARIOS_Y_PRECIOS.md](./HORARIOS_Y_PRECIOS.md)**
**Descripción**: Documentación del sistema de horarios y precios  
**Contenido**: Sistema de gestión de horarios por complejo y precios por cancha

**Cuándo leerlo**: Para trabajar con horarios y configuración de precios

---

## 🚀 Guía de Inicio Rápido

### Para Desarrolladores Backend

1. **Lee primero**: [RESUMEN_EXPLORACION.md](./RESUMEN_EXPLORACION.md)
2. **Prueba los endpoints**: [API_EXPLORACION_TESTS.http](./API_EXPLORACION_TESTS.http)
3. **Consulta la referencia**: [API_EXPLORACION.md](./API_EXPLORACION.md)
4. **Revisa mejores prácticas**: [BEST_PRACTICES.md](./BEST_PRACTICES.md)

### Para Desarrolladores Frontend

1. **Lee la referencia de API**: [API_EXPLORACION.md](./API_EXPLORACION.md)
2. **Revisa ejemplos de integración**: [FRONTEND_INTEGRATION_EXAMPLES.js](./FRONTEND_INTEGRATION_EXAMPLES.js)
3. **Usa los tests como referencia**: [API_EXPLORACION_TESTS.http](./API_EXPLORACION_TESTS.http)

### Para DevOps / Deployment

1. **Revisa mejores prácticas**: [BEST_PRACTICES.md](./BEST_PRACTICES.md)
2. **Checklist de producción**: Ver sección en BEST_PRACTICES.md
3. **Monitoreo**: Ver sección en BEST_PRACTICES.md

---

## 📋 Endpoints Principales

### Base URL (Desarrollo)
```
http://localhost:3000
```

### Sistema de Búsqueda
- `GET /api/explorar/canchas` - Buscar canchas
- `GET /api/explorar/canchas/paginado` - Buscar con paginación
- `GET /api/explorar/estadisticas` - Estadísticas de búsqueda
- `GET /api/explorar/deportes` - Listar deportes
- `GET /api/explorar/ubicaciones` - Listar ubicaciones

### Otros Sistemas
- `POST /auth/login` - Autenticación
- `GET /api/complexes` - Complejos deportivos
- `GET /api/courts` - Canchas

---

## 🎯 Flujos Comunes

### Flujo 1: Usuario busca una cancha
```
1. Usuario abre la app
2. Frontend: GET /api/explorar/deportes (cargar filtros)
3. Usuario escribe "sintética"
4. Frontend: GET /api/explorar/canchas?q=sintetica
5. Mostrar resultados
```

### Flujo 2: Usuario filtra por deporte
```
1. Usuario selecciona "Fútbol" en filtros
2. Frontend: GET /api/explorar/canchas?sport_id=1
3. Mostrar canchas de fútbol
```

### Flujo 3: Paginación infinita
```
1. Usuario scrollea hacia abajo
2. Frontend: GET /api/explorar/canchas/paginado?page=2&limit=10
3. Agregar resultados a la lista
```

---

## 🔧 Tecnologías Usadas

- **Node.js** + **Express**: Framework del servidor
- **Sequelize**: ORM para PostgreSQL
- **PostgreSQL**: Base de datos
- **CORS**: Habilitado para permitir requests del frontend
- **Morgan**: Logging de requests HTTP
- **dotenv**: Variables de entorno

---

## 📁 Estructura del Proyecto

```
backend-zyra/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── complexController.js
│   │   ├── courtController.js
│   │   └── explorarController.js ✨ NUEVO
│   ├── services/
│   │   ├── authService.js
│   │   ├── complexService.js
│   │   ├── courtService.js
│   │   └── searchService.js ✨ NUEVO
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── complexRoutes.js
│   │   ├── courtRoutes.js
│   │   └── explorarRoutes.js ✨ NUEVO
│   ├── db/
│   │   ├── db.js
│   │   └── models/
│   │       ├── complejos.js
│   │       ├── canchas.js
│   │       └── sports.js
│   ├── middlewares/
│   │   └── authMiddleware.js
│   ├── config/
│   │   └── database.js
│   └── app.js
├── docs/ 📚 ESTÁS AQUÍ
│   ├── README.md (este archivo)
│   ├── RESUMEN_EXPLORACION.md
│   ├── API_EXPLORACION.md
│   ├── API_EXPLORACION_TESTS.http
│   ├── FRONTEND_INTEGRATION_EXAMPLES.js
│   ├── BEST_PRACTICES.md
│   └── HORARIOS_Y_PRECIOS.md
├── package.json
└── .env
```

---

## 🆘 Solución de Problemas

### Problema: Los endpoints no responden
**Solución**: 
1. Verifica que el servidor esté corriendo
2. Revisa la consola por errores
3. Verifica la conexión a PostgreSQL

### Problema: "No se encontraron canchas"
**Solución**:
1. Verifica que la base de datos tenga datos
2. Revisa los filtros aplicados
3. Prueba sin filtros primero

### Problema: Error 500 en búsqueda
**Solución**:
1. Revisa los logs del servidor
2. Verifica la conexión a la BD
3. Consulta la sección de errores en la documentación

---

## 📞 Contacto y Soporte

- **Equipo Backend Zyra**
- **Última actualización**: 2026-04-08
- **Versión de la API**: 1.0.0

---

## 🎓 Recursos de Aprendizaje

### Sequelize
- [Documentación oficial](https://sequelize.org/)
- [Queries avanzadas](https://sequelize.org/docs/v6/core-concepts/model-querying-basics/)

### Express
- [Guía oficial](https://expressjs.com/en/guide/routing.html)
- [Best practices](https://expressjs.com/en/advanced/best-practice-security.html)

### PostgreSQL
- [Documentación oficial](https://www.postgresql.org/docs/)
- [ILIKE operator](https://www.postgresql.org/docs/current/functions-matching.html)

---

## ✅ Checklist de Onboarding

Si eres nuevo en el proyecto, completa estos pasos:

- [ ] Leer [RESUMEN_EXPLORACION.md](./RESUMEN_EXPLORACION.md)
- [ ] Configurar el entorno local (Node.js, PostgreSQL)
- [ ] Instalar dependencias (`npm install`)
- [ ] Configurar variables de entorno (.env)
- [ ] Probar endpoints con [API_EXPLORACION_TESTS.http](./API_EXPLORACION_TESTS.http)
- [ ] Revisar [BEST_PRACTICES.md](./BEST_PRACTICES.md)
- [ ] Familiarizarse con la estructura del código

---

## 🚀 Próximos Pasos del Proyecto

### Short-term (Sprint actual)
- [ ] Implementar filtro de disponibilidad por fecha/hora
- [ ] Agregar tests unitarios
- [ ] Implementar rate limiting

### Mid-term (Próximos sprints)
- [ ] Cache con Redis
- [ ] Búsqueda geográfica
- [ ] Sistema de favoritos

### Long-term (Roadmap)
- [ ] Recomendaciones personalizadas
- [ ] Machine learning para sugerencias
- [ ] API v2 con GraphQL

---

## 📄 Licencia

Propiedad de Zyra - Todos los derechos reservados

---

**¡Gracias por contribuir a Zyra! 🎉**

Si tienes dudas o sugerencias, no dudes en abrir un issue o contactar al equipo.
