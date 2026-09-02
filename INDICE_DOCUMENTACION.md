# 📚 Índice Maestro de Documentación - Sistema Zyra Backend

Guía completa para navegar toda la documentación del sistema de gestión de canchas, precios dinámicos y excepciones.

---

## 🎯 NUEVO: Documentación de Gestión de Canchas

**⭐ Documentos principales creados:**

1. 🎓 **[TUTORIAL_PRACTICO.md](./TUTORIAL_PRACTICO.md)** ⭐ **IDEAL PARA PRINCIPIANTES**
   - Tutorial paso a paso (15-20 minutos)
   - Configuración de 2 canchas completas
   - Importación de festivos
   - Cierre por mantenimiento
   - Verificación de funcionamiento
   - Tips profesionales

2. 📘 **[RESUMEN_EJECUTIVO_CANCHAS.md](./RESUMEN_EJECUTIVO_CANCHAS.md)** ⭐ **VISTA GENERAL**
   - Resumen completo del sistema
   - Arquitectura técnica
   - Estado de implementación (100% completo)
   - 16 endpoints funcionales
   - Métricas y estadísticas

3. 📗 **[GUIA_CONFIGURACION_CANCHAS.md](./GUIA_CONFIGURACION_CANCHAS.md)** ⭐ **GUÍA COMPLETA**
   - 50+ páginas de documentación detallada
   - Creación y gestión de canchas
   - Configuración de precios dinámicos
   - Gestión de excepciones
   - Casos de uso reales
   - Sistema de prioridades
   - Mejores prácticas

4. ⚡ **[REFERENCIA_RAPIDA_CANCHAS.md](./REFERENCIA_RAPIDA_CANCHAS.md)** ⭐ **COMANDOS RÁPIDOS**
   - Comandos listos para copiar/pegar
   - Todas las operaciones en una página
   - Configuración completa en 4 pasos
   - Tips de uso por plataforma

5. 🤖 **[scripts/](./scripts/)** ⭐ **AUTOMATIZACIÓN**
   - `configurar-cancha-completa.sh` (Bash - Linux/Mac)
   - `configurar-cancha-completa.ps1` (PowerShell - Windows)
   - `README.md` (Guía de uso de scripts)
   - Configuración automatizada completa

---

## 🚀 Inicio Rápido

**Para comenzar a usar el sistema inmediatamente:**

### Opción 1: Tutorial Paso a Paso (15-20 minutos) - RECOMENDADO
🎓 **[TUTORIAL_PRACTICO.md](./TUTORIAL_PRACTICO.md)**
- Tutorial completo desde cero
- Configuración real de un complejo
- Ejemplos paso a paso con validaciones
- Ideal para aprender el sistema

### Opción 2: Scripts de Automatización (2 minutos)
🤖 **[scripts/README.md](./scripts/README.md)**
- Configura canchas automáticamente
- Importa festivos
- Aplica estrategias de precios

### Opción 3: Resumen Ejecutivo (5 minutos)
📘 **[RESUMEN_EJECUTIVO_CANCHAS.md](./RESUMEN_EJECUTIVO_CANCHAS.md)**
- Vista general completa del sistema
- Arquitectura técnica
- Comandos esenciales
- Checklist de producción

### Opción 4: Comandos Rápidos (1 minuto)
⚡ **[REFERENCIA_RAPIDA_CANCHAS.md](./REFERENCIA_RAPIDA_CANCHAS.md)**
- Comandos listos para copiar/pegar
- Todas las operaciones básicas

### Opción 5: Guía Detallada (30 minutos)
📗 **[GUIA_CONFIGURACION_CANCHAS.md](./GUIA_CONFIGURACION_CANCHAS.md)**
- Documentación técnica completa
- Explicaciones detalladas
- Ejemplos exhaustivos

---

## 📖 Documentación Original - Precios y Excepciones

1. 📖 **[COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md)**
   - Comandos listos para copiar y pegar
   - Casos de prueba completos
   - Troubleshooting

---

## 📋 Documentación General

### Resumen y Arquitectura

1. 📄 **[RESUMEN_IMPLEMENTACION.md](./RESUMEN_IMPLEMENTACION.md)**
   - Estado de la implementación
   - Archivos creados
   - Métricas y estadísticas
   - **📍 EMPIEZA AQUÍ si quieres una visión general**

2. 📄 **[README_PRECIOS_Y_EXCEPCIONES.md](./README_PRECIOS_Y_EXCEPCIONES.md)**
   - Arquitectura del sistema
   - Flujos de trabajo completos
   - Sistema de prioridades
   - Próximos pasos sugeridos

---

## 🔍 Documentación por Funcionalidad

### Precios Dinámicos de Canchas

📘 **[src/routes/PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md)**

**Contenido:**
- ✅ 5 endpoints documentados
- ✅ Conceptos clave (tipo_dia, franjas horarias)
- ✅ Ejemplos de request/response
- ✅ 3 casos de uso reales:
  - Estrategia Prime (fin de semana caro)
  - Happy Hour (descuentos en baja demanda)
  - Precio Único Simplificado
- ✅ Notas importantes y mejores prácticas

**Endpoints:**
```
POST   /api/courts/:id/precios              - Configurar
GET    /api/courts/:id/precios              - Consultar
PUT    /api/courts/:id/precios/:precioId    - Actualizar
DELETE /api/courts/:id/precios/:precioId    - Eliminar franja
DELETE /api/courts/:id/precios              - Eliminar todos
```

---

### Excepciones de Calendario

📗 **[src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md](./src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md)**

**Contenido:**
- ✅ 6 endpoints documentados
- ✅ Tipos de excepciones (festivos, cierres, eventos)
- ✅ Ejemplos de request/response
- ✅ Festivos Colombia 2026 completos
- ✅ Integración con precios dinámicos
- ✅ Filtros avanzados (fechas, festivos, cerrados)

**Endpoints:**
```
POST   /api/complexes/:id/excepciones          - Agregar una
POST   /api/complexes/:id/excepciones/bulk     - Agregar múltiples
GET    /api/complexes/:id/excepciones          - Listar
GET    /api/complexes/:id/excepciones/:fecha   - Consultar fecha
PUT    /api/complexes/:id/excepciones/:fecha   - Actualizar
DELETE /api/complexes/:id/excepciones/:fecha   - Eliminar
```

---

## 🗂️ Archivos de Datos

📂 **[src/routes/data/README.md](./src/routes/data/README.md)**

**Contenido:**
- ✅ Guía de uso de archivos JSON
- ✅ Comandos curl con archivos
- ✅ Personalización de datos
- ✅ Testing rápido

**Archivos disponibles:**
1. `festivos-colombia-2026.json` - 19 festivos
2. `precios-estrategia-prime.json` - Fin de semana premium
3. `precios-estrategia-happy-hour.json` - Descuentos por horario
4. `precios-estrategia-simple.json` - Precio único por día

---

## 🧪 Testing y Pruebas

🔬 **[COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md)**

**Contenido:**
- ✅ 30+ comandos listos para usar
- ✅ Cómo obtener token de autenticación
- ✅ Pruebas de precios dinámicos
- ✅ Pruebas de excepciones
- ✅ Flujo completo de configuración
- ✅ 3 escenarios de prueba completos
- ✅ Troubleshooting común

---

## 📂 Estructura de Archivos

```
backend-zyra/
├── src/
│   ├── controllers/
│   │   ├── courtPriceController.js          ← Precios dinámicos
│   │   └── calendarExceptionController.js   ← Excepciones
│   │
│   ├── routes/
│   │   ├── courtRoutes.js                   ← Rutas actualizadas
│   │   ├── complexRoutes.js                 ← Rutas actualizadas
│   │   │
│   │   ├── PRECIOS_CANCHA_EXAMPLES.md       ← Docs precios
│   │   ├── EXCEPCIONES_CALENDARIO_EXAMPLES.md ← Docs excepciones
│   │   │
│   │   └── data/
│   │       ├── README.md                    ← Guía de datos
│   │       ├── festivos-colombia-2026.json
│   │       ├── precios-estrategia-prime.json
│   │       ├── precios-estrategia-happy-hour.json
│   │       └── precios-estrategia-simple.json
│   │
│   └── db/
│       ├── db.js                            ← Relaciones configuradas
│       └── models/
│           ├── cancha_horarios_precios.js
│           └── calendario_excepciones.js
│
├── INDICE_DOCUMENTACION.md                  ← Este archivo
├── RESUMEN_IMPLEMENTACION.md                ← Resumen completo
├── README_PRECIOS_Y_EXCEPCIONES.md          ← Arquitectura
└── COMANDOS_PRUEBA.md                       ← Testing
```

---

## 🎯 Guías por Rol

### Desarrollador Backend

**Para implementar o mantener el código:**

1. 📄 [RESUMEN_IMPLEMENTACION.md](./RESUMEN_IMPLEMENTACION.md) - Visión general
2. 📘 [courtPriceController.js](./src/controllers/courtPriceController.js) - Código precios
3. 📗 [calendarExceptionController.js](./src/controllers/calendarExceptionController.js) - Código excepciones
4. 📄 [README_PRECIOS_Y_EXCEPCIONES.md](./README_PRECIOS_Y_EXCEPCIONES.md) - Arquitectura

### QA / Tester

**Para probar las funcionalidades:**

1. 🔬 [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md) - Comandos de prueba
2. 📂 [src/routes/data/README.md](./src/routes/data/README.md) - Datos de prueba
3. 📘 [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md) - Casos esperados
4. 📗 [EXCEPCIONES_CALENDARIO_EXAMPLES.md](./src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md) - Casos esperados

### Desarrollador Frontend

**Para integrar con el frontend:**

1. 📘 [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md) - API de precios
2. 📗 [EXCEPCIONES_CALENDARIO_EXAMPLES.md](./src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md) - API de excepciones
3. 🔬 [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md) - Ejemplos de uso
4. 📄 [README_PRECIOS_Y_EXCEPCIONES.md](./README_PRECIOS_Y_EXCEPCIONES.md) - Flujos de negocio

### Dueño de Complejo / Usuario Final

**Para entender cómo configurar el sistema:**

1. 📂 [src/routes/data/README.md](./src/routes/data/README.md) - Guía rápida
2. 📘 [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md) - Casos de uso
3. 📗 [EXCEPCIONES_CALENDARIO_EXAMPLES.md](./src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md) - Festivos y cierres

---

## 🔗 Referencias Cruzadas

### Configurar un Complejo desde Cero

1. [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md) → "Flujo Completo"
2. [src/routes/data/README.md](./src/routes/data/README.md) → "Flujo Completo Recomendado"
3. [README_PRECIOS_Y_EXCEPCIONES.md](./README_PRECIOS_Y_EXCEPCIONES.md) → "Caso de Uso"

### Estrategias de Precios

1. [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md) → "Casos de Uso Comunes"
2. [src/routes/data/](./src/routes/data/) → Archivos JSON de estrategias

### Festivos y Excepciones

1. [EXCEPCIONES_CALENDARIO_EXAMPLES.md](./src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md) → "Casos de Uso Comunes"
2. [src/routes/data/festivos-colombia-2026.json](./src/routes/data/festivos-colombia-2026.json) → Datos listos

---

## 🔍 Búsqueda Rápida

### "¿Cómo configuro precios diferentes por día?"
→ [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md) → Sección 1

### "¿Cómo marco un día festivo?"
→ [EXCEPCIONES_CALENDARIO_EXAMPLES.md](./src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md) → Sección 1

### "¿Cómo importo todos los festivos de Colombia?"
→ [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md) → Sección "Excepciones de Calendario" → #3

### "¿Qué estrategia de precios usar?"
→ [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md) → "Casos de Uso Comunes"

### "¿Cómo funciona la prioridad de precios?"
→ [README_PRECIOS_Y_EXCEPCIONES.md](./README_PRECIOS_Y_EXCEPCIONES.md) → "Sistema de Prioridades"

### "¿Comandos para probar rápido?"
→ [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md) → Primera sección

---

## 📊 Estadísticas de Documentación

| Tipo | Cantidad | Páginas |
|------|----------|---------|
| Archivos de docs | 6 | ~60 |
| Controladores | 2 | ~30 |
| Archivos de datos | 4 | - |
| Endpoints | 11 | - |
| Ejemplos de código | 50+ | - |
| Comandos de prueba | 30+ | - |

---

## 💡 Tips de Navegación

1. **Usa Ctrl+F** para buscar términos específicos dentro de los archivos
2. **Sigue los enlaces** para navegar entre documentos relacionados
3. **Comienza por el resumen** si es tu primera vez
4. **Usa los comandos de prueba** para aprender haciendo
5. **Lee los casos de uso** para inspirarte en configuraciones

---

## 🆘 ¿Necesitas Ayuda?

### Problema con autenticación
→ [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md) → "Troubleshooting"

### No entiendo cómo funcionan los precios
→ [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md) → "Conceptos Clave"

### Error en los comandos
→ [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md) → "Troubleshooting" → "Tips"

### Necesito más ejemplos
→ [src/routes/data/README.md](./src/routes/data/README.md) → Todos los archivos JSON

---

## 🎓 Ruta de Aprendizaje Recomendada

### Nivel 1: Conceptos Básicos
1. [RESUMEN_IMPLEMENTACION.md](./RESUMEN_IMPLEMENTACION.md)
2. [README_PRECIOS_Y_EXCEPCIONES.md](./README_PRECIOS_Y_EXCEPCIONES.md) → "Conceptos Clave"

### Nivel 2: API y Endpoints
3. [PRECIOS_CANCHA_EXAMPLES.md](./src/routes/PRECIOS_CANCHA_EXAMPLES.md)
4. [EXCEPCIONES_CALENDARIO_EXAMPLES.md](./src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md)

### Nivel 3: Práctica
5. [COMANDOS_PRUEBA.md](./COMANDOS_PRUEBA.md)
6. [src/routes/data/README.md](./src/routes/data/README.md)

### Nivel 4: Implementación
7. [courtPriceController.js](./src/controllers/courtPriceController.js)
8. [calendarExceptionController.js](./src/controllers/calendarExceptionController.js)

---

**📍 Última actualización**: 17 de Abril, 2026

**✨ Sistema completamente documentado y listo para usar**
