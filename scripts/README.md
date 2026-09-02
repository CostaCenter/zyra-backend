# 🚀 Scripts de Automatización - Configuración de Canchas

Este directorio contiene scripts para automatizar la configuración completa de canchas en el sistema Zyra.

## 🧪 Scripts de prueba (`test-*.mjs`)

Reglas obligatorias para cualquier script de prueba del backend:

1. **Torneo propio:** crear siempre un torneo de prueba (`visibilidad: 'PRIVADO'`, nombre con prefijo `TEST_`).
2. **No tocar torneos reales:** nunca modificar torneos creados desde la app (p. ej. **Zyra CUP**, id=5) ni datos de producción/usuario.
3. **Limpieza al finalizar:** eliminar al terminar el torneo de prueba, sus fases, inscripciones, partidos y registros asociados.
4. **Equipos de prueba:** si se crean equipos, usar el mismo prefijo `TEST_` del torneo (p. ej. `TEST_ORGANIZADOR_PANEL_ZYRA_TEAM_1`).

Ejemplo: `test-torneo-organizador-flow.mjs` crea `TEST_ORGANIZADOR_PANEL_ZYRA`, ejecuta el flujo completo y lo borra al final.

---
## 📋 Scripts Disponibles

### 1. Bash Script (Linux/Mac)
**Archivo:** `configurar-cancha-completa.sh`

**Uso:**
```bash
# Dar permisos de ejecución
chmod +x configurar-cancha-completa.sh

# Ejecutar
./configurar-cancha-completa.sh
```

### 2. PowerShell Script (Windows)
**Archivo:** `configurar-cancha-completa.ps1`

**Uso:**
```powershell
# Ejecutar
.\configurar-cancha-completa.ps1
```

---

## ⚙️ Configuración

Antes de ejecutar los scripts, **edita las variables** al inicio del archivo:

```bash
# URL del servidor
API_URL="http://localhost:3000"

# Credenciales (CAMBIAR por tus datos reales)
EMAIL="admin@zyra.com"
PASSWORD="admin123"

# ID del complejo (CAMBIAR por tu ID real)
COMPLEJO_ID=3

# Datos de la cancha
CANCHA_NOMBRE="Cancha Fútbol 5 - Premium"
CANCHA_DEPORTE="Fútbol"
CANCHA_SPORT_ID=1
CANCHA_PRECIO_BASE=50000

# Estrategia de precios: prime, happy-hour, o simple
ESTRATEGIA_PRECIOS="prime"
```

---

## 📝 ¿Qué hace el script?

El script automatiza **6 pasos** de configuración:

1. **Autenticación**
   - Login con email y password
   - Obtención del token JWT

2. **Verificación de Acceso**
   - Verifica que el complejo existe
   - Confirma que tienes permisos

3. **Creación de Cancha**
   - Crea una nueva cancha con los datos configurados
   - Obtiene el ID de la cancha creada

4. **Importación de Festivos**
   - Importa los 19 festivos de Colombia 2026
   - Usa el archivo `festivos-colombia-2026.json`

5. **Configuración de Precios Dinámicos**
   - Aplica la estrategia de precios seleccionada
   - Usa archivos predefinidos (prime, happy-hour, simple)

6. **Verificación Final**
   - Consulta la cancha creada
   - Muestra los precios configurados
   - Lista los festivos importados

---

## 🎯 Estrategias de Precios Disponibles

### Estrategia Prime (`prime`)
- Lun-Jue: $60,000 todo el día
- Viernes: $60,000 hasta 18h, luego $100,000
- Sábado: $90,000 todo el día
- Festivos: $120,000 todo el día

### Estrategia Happy Hour (`happy-hour`)
- Descuentos en horarios de baja demanda
- 21 configuraciones de precios
- Incentiva reservas en horas valle

### Estrategia Simple (`simple`)
- Precio único por día
- Más caro fin de semana
- Fácil de entender para usuarios

---

## 📂 Archivos Requeridos

Los scripts dependen de estos archivos en `src/routes/data/`:

```
src/routes/data/
├── festivos-colombia-2026.json
├── precios-estrategia-prime.json
├── precios-estrategia-happy-hour.json
└── precios-estrategia-simple.json
```

Si estos archivos no existen, el script lo notificará y saltará esos pasos.

---

## ✅ Prerequisitos

### Para Bash (Linux/Mac)
- `curl` instalado
- `python` (opcional, para formatear JSON)
- Servidor backend corriendo en `http://localhost:3000`

### Para PowerShell (Windows)
- PowerShell 5.1 o superior
- Servidor backend corriendo en `http://localhost:3000`

---

## 📊 Ejemplo de Salida

```
╔════════════════════════════════════════════════════════════╗
║    SCRIPT DE CONFIGURACIÓN - SISTEMA DE CANCHAS ZYRA      ║
╚════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PASO 1: Autenticación
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Iniciando sesión como admin@zyra.com...
✅ Token obtenido exitosamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PASO 2: Verificación de Acceso
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Verificando acceso al complejo ID: 3...
✅ Acceso al complejo: Complejo El Campeón

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PASO 3: Creación de Cancha
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Crear cancha...
✅ Crear cancha completado
✅ Cancha creada con ID: 15

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PASO 4: Importación de Festivos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Importando 19 festivos de Colombia 2026...
✅ Festivos importados exitosamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PASO 5: Configuración de Precios Dinámicos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Aplicando estrategia de precios: prime...
✅ Precios dinámicos configurados exitosamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PASO 6: Verificación Final
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Consultando configuración de la cancha...

╔════════════════════════════════════════════════════════════╗
║              ✅ CONFIGURACIÓN COMPLETADA ✅                 ║
╚════════════════════════════════════════════════════════════╝

Resumen:
  • Complejo: Complejo El Campeón (ID: 3)
  • Cancha creada: Cancha Fútbol 5 - Premium (ID: 15)
  • Precio base: $50,000
  • Estrategia de precios: prime

Próximos pasos:
  1. Revisar la configuración en el dashboard
  2. Probar crear una reserva
  3. Agregar más canchas si es necesario

✅ ¡Todo listo para empezar a recibir reservas! 🎉
```

---

## 🔧 Solución de Problemas

### Error: "No se pudo obtener el token"
- Verifica que el servidor esté corriendo
- Comprueba las credenciales (email y password)
- Asegúrate de que la URL del API es correcta

### Error: "Complejo no encontrado"
- Verifica que el `COMPLEJO_ID` existe en tu base de datos
- Consulta tus complejos: `GET /api/complexes/my-complexes`

### Error: "Archivo no encontrado"
- Ejecuta el script desde la raíz del proyecto
- Verifica que existen los archivos en `src/routes/data/`

### Permisos denegados (Linux/Mac)
```bash
chmod +x configurar-cancha-completa.sh
```

### Política de ejecución (Windows PowerShell)
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\configurar-cancha-completa.ps1
```

---

## 🎓 Uso Avanzado

### Crear múltiples canchas

Ejecuta el script varias veces cambiando:
- `CANCHA_NOMBRE`
- `ESTRATEGIA_PRECIOS`

### Diferentes estrategias por cancha

```bash
# Cancha principal con estrategia premium
ESTRATEGIA_PRECIOS="prime"
./configurar-cancha-completa.sh

# Cancha secundaria con precios simples
CANCHA_NOMBRE="Cancha Fútbol 5 - Secundaria"
ESTRATEGIA_PRECIOS="simple"
./configurar-cancha-completa.sh
```

### Usar en producción

Cambia la URL del servidor:
```bash
API_URL="https://api.tudominio.com"
```

---

## 📚 Documentación Relacionada

- `GUIA_CONFIGURACION_CANCHAS.md` - Guía completa
- `REFERENCIA_RAPIDA_CANCHAS.md` - Comandos rápidos
- `COMANDOS_PRUEBA.md` - 30+ comandos de prueba
- `COURTS_README.md` - Documentación CRUD de canchas

---

## 🤝 Contribuciones

Si mejoras los scripts, considera:
- Agregar más validaciones
- Mejorar mensajes de error
- Agregar logging a archivo
- Crear versión interactiva (con prompts)

---

**Última actualización:** 17 de Abril, 2026  
**Versión:** 1.0  
**Sistema:** Zyra Backend
