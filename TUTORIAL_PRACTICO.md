# 🎓 Tutorial Práctico - Configuración de Canchas desde Cero

**Nivel:** Principiante  
**Tiempo estimado:** 15-20 minutos  
**Objetivo:** Configurar un complejo deportivo completo con canchas, precios dinámicos y festivos

---

## 📋 Prerequisitos

- Servidor backend corriendo en `http://localhost:3000`
- Cuenta de usuario creada
- Un complejo deportivo creado
- Terminal o PowerShell abierta

---

## 🎯 Escenario del Tutorial

Vamos a configurar el **"Complejo Deportivo La Victoria"** con:

- 2 canchas de fútbol 5
- Precios diferentes para cada cancha
- Precios especiales en horarios prime
- Festivos de Colombia 2026
- Cierre por mantenimiento programado

---

## PASO 1: Obtener tu Token de Autenticación

### 1.1 Login

**Comando:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@lavictoria.com",
    "password": "mipassword123"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "nombre": "Juan Pérez",
    "email": "admin@lavictoria.com"
  }
}
```

### 1.2 Guardar el Token

**Bash/Linux/Mac:**
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**PowerShell/Windows:**
```powershell
$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

✅ **Checkpoint:** Verifica que el token se guardó correctamente:
```bash
echo $TOKEN    # Bash
$TOKEN         # PowerShell
```

---

## PASO 2: Verificar tu Complejo

### 2.1 Listar tus Complejos

**Comando:**
```bash
curl http://localhost:3000/api/complexes/my-complexes \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "nombre": "Complejo Deportivo La Victoria",
      "ubicacion": "Cali, Valle del Cauca",
      "dueño_id": 5
    }
  ]
}
```

### 2.2 Anotar el ID del Complejo

**ID del complejo:** `3`  
Lo usaremos en los siguientes pasos.

✅ **Checkpoint:** Tu complejo aparece en la lista y tienes su ID.

---

## PASO 3: Crear la Primera Cancha (Principal)

### 3.1 Crear Cancha Principal

**Comando:**
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

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Cancha creada exitosamente",
  "data": {
    "id": 8,
    "complejo_id": 3,
    "nombre": "Cancha Fútbol 5 - Principal",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": "50000.00",
    "state": "DISPONIBLE",
    "complejo": {
      "id": 3,
      "nombre": "Complejo Deportivo La Victoria",
      "ubicacion": "Cali, Valle del Cauca"
    }
  }
}
```

### 3.2 Anotar el ID de la Cancha

**ID de la cancha principal:** `8`

✅ **Checkpoint:** Cancha creada con ID 8.

---

## PASO 4: Crear la Segunda Cancha (Secundaria)

### 4.1 Crear Cancha Secundaria

**Comando:**
```bash
curl -X POST http://localhost:3000/api/courts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "complejo_id": 3,
    "nombre": "Cancha Fútbol 5 - Secundaria",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": 40000,
    "state": "DISPONIBLE"
  }'
```

**ID de la cancha secundaria:** `9` (anota el ID de la respuesta)

✅ **Checkpoint:** Dos canchas creadas (IDs: 8 y 9).

---

## PASO 5: Configurar Precios de la Cancha Principal

### 5.1 Aplicar Estrategia Premium

La cancha principal tendrá precios más altos en horarios prime.

**Comando:**
```bash
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "precios": [
      {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
      {"tipo_dia": 2, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
      {"tipo_dia": 3, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
      {"tipo_dia": 4, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
      {"tipo_dia": 5, "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 60000},
      {"tipo_dia": 5, "hora_inicio": "18:00", "hora_fin": "23:00", "precio_hora": 100000},
      {"tipo_dia": 6, "hora_inicio": "09:00", "hora_fin": "23:00", "precio_hora": 90000},
      {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 120000}
    ]
  }'
```

**Resultado:**
- Lun-Jue: $60,000/hora
- Viernes: $60,000 hasta las 18h, luego $100,000
- Sábado: $90,000/hora
- Festivos: $120,000/hora

### 5.2 Verificar Precios

**Comando:**
```bash
curl http://localhost:3000/api/courts/8/precios
```

✅ **Checkpoint:** Precios dinámicos configurados para la cancha 8.

---

## PASO 6: Configurar Precios de la Cancha Secundaria

### 6.1 Aplicar Estrategia Simple

La cancha secundaria tendrá precios más accesibles y simples.

**Comando:**
```bash
curl -X POST http://localhost:3000/api/courts/9/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "precios": [
      {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 40000},
      {"tipo_dia": 2, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 40000},
      {"tipo_dia": 3, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 40000},
      {"tipo_dia": 4, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 40000},
      {"tipo_dia": 5, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 50000},
      {"tipo_dia": 6, "hora_inicio": "09:00", "hora_fin": "23:00", "precio_hora": 60000},
      {"tipo_dia": 0, "hora_inicio": "09:00", "hora_fin": "20:00", "precio_hora": 60000},
      {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 80000}
    ]
  }'
```

**Resultado:**
- Lun-Jue: $40,000/hora
- Viernes: $50,000/hora
- Sáb-Dom: $60,000/hora
- Festivos: $80,000/hora

✅ **Checkpoint:** Ambas canchas tienen precios configurados.

---

## PASO 7: Importar Festivos de Colombia 2026

### 7.1 Importar los 19 Festivos

**Comando:**
```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

**Nota:** Asegúrate de ejecutar desde la raíz del proyecto o ajusta la ruta del archivo.

**Festivos incluidos:**
- Año Nuevo (1 de enero)
- Reyes Magos (12 de enero)
- San José (23 de marzo)
- Jueves Santo (9 de abril)
- Viernes Santo (10 de abril)
- Día del Trabajo (1 de mayo)
- Ascensión del Señor (18 de mayo)
- Corpus Christi (8 de junio)
- Sagrado Corazón (15 de junio)
- San Pedro y San Pablo (29 de junio)
- Independencia (20 de julio)
- Batalla de Boyacá (7 de agosto)
- Asunción (17 de agosto)
- Día de la Raza (12 de octubre)
- Todos los Santos (2 de noviembre)
- Independencia de Cartagena (16 de noviembre)
- Inmaculada Concepción (8 de diciembre)
- Navidad (25 de diciembre)

### 7.2 Verificar Festivos Importados

**Comando:**
```bash
curl "http://localhost:3000/api/complexes/3/excepciones?solo_festivos=true"
```

✅ **Checkpoint:** 19 festivos importados correctamente.

---

## PASO 8: Agregar Cierre por Mantenimiento

### 8.1 Programar Mantenimiento

Vamos a cerrar el complejo la semana del 10 al 14 de agosto para mantenimiento.

**Comando:**
```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "excepciones": [
      {"fecha": "2026-08-10", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Día 1"},
      {"fecha": "2026-08-11", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Día 2"},
      {"fecha": "2026-08-12", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Día 3"},
      {"fecha": "2026-08-13", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Día 4"},
      {"fecha": "2026-08-14", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Día 5"}
    ]
  }'
```

### 8.2 Verificar Cierres

**Comando:**
```bash
curl "http://localhost:3000/api/complexes/3/excepciones?solo_cerrados=true"
```

✅ **Checkpoint:** 5 días de cierre programados.

---

## PASO 9: Verificación Final

### 9.1 Ver Todas las Canchas del Complejo

**Comando:**
```bash
curl http://localhost:3000/api/courts/complex/3
```

**Resultado esperado:**
- 2 canchas listadas
- Ambas en estado DISPONIBLE
- Precios base mostrados

### 9.2 Ver Precios de Cancha Principal

**Comando:**
```bash
curl http://localhost:3000/api/courts/8/precios
```

### 9.3 Ver Precios de Cancha Secundaria

**Comando:**
```bash
curl http://localhost:3000/api/courts/9/precios
```

### 9.4 Ver Todas las Excepciones

**Comando:**
```bash
curl http://localhost:3000/api/complexes/3/excepciones
```

**Resultado esperado:**
- 19 festivos
- 5 días de mantenimiento
- Total: 24 excepciones

✅ **Checkpoint:** ¡Configuración completa!

---

## PASO 10: Pruebas de Funcionamiento

### 10.1 Consultar Precio en Día Normal

**Escenario:** Lunes 1 de junio, 2026 a las 10:00

**Comando:**
```bash
curl http://localhost:3000/api/courts/8/precios
```

**Resultado esperado:**
- Lunes (tipo_dia: 1)
- Franja 08:00-22:00
- **Precio: $60,000/hora**

### 10.2 Consultar Precio en Horario Prime

**Escenario:** Viernes 5 de junio, 2026 a las 20:00

**Resultado esperado:**
- Viernes (tipo_dia: 5)
- Franja 18:00-23:00
- **Precio: $100,000/hora**

### 10.3 Consultar Festivo

**Escenario:** Domingo 20 de julio, 2026 (Independencia)

**Comando:**
```bash
curl http://localhost:3000/api/complexes/3/excepciones/2026-07-20
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Excepción encontrada para la fecha 2026-07-20",
  "data": {
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia de Colombia"
  }
}
```

**Precio esperado:** $120,000/hora (tipo_dia: 7)

### 10.4 Consultar Día Cerrado

**Comando:**
```bash
curl http://localhost:3000/api/complexes/3/excepciones/2026-08-10
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "fecha": "2026-08-10",
    "esta_abierto": false,
    "es_festivo": false,
    "descripcion": "Mantenimiento - Día 1"
  }
}
```

---

## 🎉 ¡Felicidades! Configuración Completada

Has configurado exitosamente:

✅ **Complejo Deportivo La Victoria**
- 2 canchas de fútbol 5
- Precios diferenciados por cancha
- Estrategia premium en cancha principal
- Estrategia simple en cancha secundaria

✅ **Precios Dinámicos**
- Precios por día de la semana
- Horarios prime con precios elevados
- Precios especiales para festivos

✅ **Gestión de Excepciones**
- 19 festivos de Colombia 2026
- 5 días de cierre por mantenimiento

---

## 📊 Resumen de Precios

### Cancha Principal (ID: 8)

| Día | Horario | Precio/Hora |
|-----|---------|-------------|
| Lun-Jue | 08:00-22:00 | $60,000 |
| Viernes | 08:00-18:00 | $60,000 |
| Viernes | 18:00-23:00 | $100,000 ⭐ |
| Sábado | 09:00-23:00 | $90,000 |
| Festivos | 08:00-23:00 | $120,000 🎉 |

### Cancha Secundaria (ID: 9)

| Día | Horario | Precio/Hora |
|-----|---------|-------------|
| Lun-Jue | 08:00-22:00 | $40,000 |
| Viernes | 08:00-23:00 | $50,000 |
| Sáb-Dom | 09:00-20:00 | $60,000 |
| Festivos | 08:00-23:00 | $80,000 🎉 |

---

## 🚀 Próximos Pasos

1. **Probar Reservas**
   - Intenta crear una reserva en la cancha
   - Verifica que el sistema calcule el precio correcto

2. **Agregar Más Canchas**
   - Repite los pasos para agregar más canchas
   - Experimenta con diferentes estrategias

3. **Personalizar Precios**
   - Ajusta los precios según tu mercado
   - Crea tus propias estrategias

4. **Configurar Frontend**
   - Integra con el dashboard
   - Crea UI para gestión visual

---

## 💡 Tips Profesionales

### Estrategia de Precios

1. **Analiza tu Competencia**
   - Investiga precios de complejos cercanos
   - Ajusta según tu ubicación y calidad

2. **Horarios Prime**
   - Identifica las horas de mayor demanda
   - Aumenta precios en esos horarios (20-50%)

3. **Festivos**
   - Los festivos suelen tener alta demanda
   - Considera precios 50-100% más altos

4. **Descuentos Estratégicos**
   - Ofrece descuentos en horarios de baja demanda
   - Incentiva reservas anticipadas

### Gestión de Excepciones

1. **Planifica con Anticipación**
   - Importa festivos al inicio del año
   - Programa mantenimientos con 2-3 meses de anticipación

2. **Comunica Claramente**
   - Usa descripciones claras en las excepciones
   - Notifica a usuarios con tiempo

3. **Revisa Regularmente**
   - Verifica que los festivos estén actualizados
   - Elimina excepciones pasadas si es necesario

---

## 🔗 Recursos Adicionales

- **Guía Completa:** `GUIA_CONFIGURACION_CANCHAS.md`
- **Referencia Rápida:** `REFERENCIA_RAPIDA_CANCHAS.md`
- **Scripts de Automatización:** `scripts/README.md`
- **Comandos de Prueba:** `COMANDOS_PRUEBA.md`

---

**Tutorial completado exitosamente** 🎊

**¿Tienes dudas?** Consulta la documentación completa o los archivos de ejemplo.

**¿Quieres automatizar?** Usa los scripts en `scripts/` para configurar múltiples canchas rápidamente.

---

**Última actualización:** 17 de Abril, 2026  
**Versión:** 1.0  
**Sistema:** Zyra Backend
