# Sistema de Horarios y Precios - Zyra

## 📋 Descripción

Sistema jerárquico de configuración de horarios y precios para complejos deportivos. El sistema valida en dos niveles:

1. **Horario del Complejo**: Define cuándo está abierto el complejo (días y horas)
2. **Precios por Cancha**: Define tarifas específicas por cancha, día y bloque horario

## 🏗️ Arquitectura

### Jerarquía de Validación

```
Cliente solicita reserva
        ↓
1. ¿El complejo está abierto ese día/hora?
        ↓ NO → Rechazar: "Complejo Cerrado"
        ↓ SÍ
2. ¿Existe precio configurado para esa cancha en ese horario?
        ↓ NO → Rechazar: "Sin precio configurado"
        ↓ SÍ
3. Retornar precio disponible ✓
```

### Modelos de Base de Datos

#### `complejo_horarios`
```javascript
{
  id: INTEGER (PK),
  complejo_id: INTEGER,
  dia_semana: INTEGER,        // 0=Domingo, 1=Lunes, ..., 6=Sábado
  hora_apertura: TIME,        // Ej: '08:00'
  hora_cierre: TIME,          // Ej: '22:00'
  esta_cerrado: BOOLEAN       // true para festivos/mantenimiento
}
```

**Índice único**: `(complejo_id, dia_semana)`

#### `cancha_horarios_precios`
```javascript
{
  id: INTEGER (PK),
  cancha_id: INTEGER,
  tipo_dia: INTEGER,          // 0=Dom, 1=Lun, ..., 6=Sab, 7=FESTIVO
  hora_inicio: TIME,          // Ej: '08:00'
  hora_fin: TIME,             // Ej: '14:00'
  precio_hora: DECIMAL(10,2)  // Ej: 80000.00
}
```

**Índice único**: `(cancha_id, tipo_dia, hora_inicio)`

## 🚀 Instalación

### 1. Ejecutar migración SQL

```bash
# Ejecutar el script de migración para agregar índices únicos
mysql -u usuario -p nombre_bd < src/db/migrations/add_unique_indexes_horarios.sql
```

### 2. Importar servicios

```javascript
import { 
  getAvailablePrice,
  verificarComplejoAbierto,
  getPreciosPorCancha,
  getHorariosComplejo
} from './services/horarios/horariosService.js';

import {
  configurarHorariosComplejo,
  configurarHorarioEstandar,
  configurarPreciosCancha,
  configurarPrecioEstandar,
  configurarComplejoCompleto
} from './services/horarios/configuracionService.js';
```

## 📖 Guía de Uso

### Caso 1: Configuración Inicial de un Complejo

```javascript
import { configurarComplejoCompleto } from './services/horarios/configuracionService.js';

// Configurar complejo completo con todas sus canchas
const resultado = await configurarComplejoCompleto({
  complejo_id: 1,
  
  // Horarios del complejo
  horarios_complejo: {
    lun_vie_apertura: '08:00',
    lun_vie_cierre: '22:00',
    sab_apertura: '09:00',
    sab_cierre: '23:00',
    dom_apertura: '10:00',
    dom_cierre: '20:00'
  },
  
  // Configuración de canchas
  canchas: [
    {
      cancha_id: 1,
      
      // Lunes a Viernes: horario normal y pico
      precios_lun_vie: {
        hora_apertura: '08:00',
        hora_cierre: '22:00',
        hora_pico_inicio: '18:00',
        hora_pico_fin: '21:00',
        precio_normal: 80000,
        precio_pico: 120000
      },
      
      // Sábado: precio único
      precios_sab: { 
        hora_inicio: '09:00', 
        hora_fin: '23:00', 
        precio: 100000 
      },
      
      // Domingo: precio único
      precios_dom: { 
        hora_inicio: '10:00', 
        hora_fin: '20:00', 
        precio: 100000 
      }
    },
    {
      cancha_id: 2,
      precios_lun_vie: {
        hora_apertura: '08:00',
        hora_cierre: '22:00',
        hora_pico_inicio: '18:00',
        hora_pico_fin: '21:00',
        precio_normal: 70000,
        precio_pico: 110000
      },
      precios_sab: { 
        hora_inicio: '09:00', 
        hora_fin: '23:00', 
        precio: 90000 
      },
      precios_dom: { 
        hora_inicio: '10:00', 
        hora_fin: '20:00', 
        precio: 90000 
      }
    }
  ]
});

console.log(resultado);
// {
//   success: true,
//   horarios_complejo: 7,
//   canchas_configuradas: 2,
//   detalles: [...]
// }
```

### Caso 2: Configuración Manual Paso a Paso

#### 2.1 Configurar Horarios del Complejo

```javascript
import { configurarHorariosComplejo } from './services/horarios/configuracionService.js';

// Opción A: Configuración personalizada
await configurarHorariosComplejo(1, [
  { dia_semana: 0, hora_apertura: '10:00', hora_cierre: '20:00' }, // Domingo
  { dia_semana: 1, hora_apertura: '08:00', hora_cierre: '22:00' }, // Lunes
  { dia_semana: 2, hora_apertura: '08:00', hora_cierre: '22:00' }, // Martes
  { dia_semana: 3, hora_apertura: '08:00', hora_cierre: '22:00' }, // Miércoles
  { dia_semana: 4, hora_apertura: '08:00', hora_cierre: '22:00' }, // Jueves
  { dia_semana: 5, hora_apertura: '08:00', hora_cierre: '22:00' }, // Viernes
  { dia_semana: 6, hora_apertura: '09:00', hora_cierre: '23:00' }  // Sábado
]);

// Opción B: Usar función helper para horario estándar
import { configurarHorarioEstandar } from './services/horarios/configuracionService.js';

await configurarHorarioEstandar(1, {
  lun_vie_apertura: '08:00',
  lun_vie_cierre: '22:00',
  sab_apertura: '09:00',
  sab_cierre: '23:00',
  dom_apertura: '10:00',
  dom_cierre: '20:00'
});
```

#### 2.2 Configurar Precios de Cancha

```javascript
import { 
  configurarPreciosCancha,
  configurarPrecioEstandar,
  configurarPrecioSimple 
} from './services/horarios/configuracionService.js';

// Opción A: Configuración totalmente personalizada
await configurarPreciosCancha(1, [
  // Lunes: 3 bloques de precios
  { tipo_dia: 1, hora_inicio: '08:00', hora_fin: '18:00', precio_hora: 80000 },
  { tipo_dia: 1, hora_inicio: '18:00', hora_fin: '21:00', precio_hora: 120000 },
  { tipo_dia: 1, hora_inicio: '21:00', hora_fin: '22:00', precio_hora: 80000 },
  
  // Martes: mismo esquema
  { tipo_dia: 2, hora_inicio: '08:00', hora_fin: '18:00', precio_hora: 80000 },
  { tipo_dia: 2, hora_inicio: '18:00', hora_fin: '21:00', precio_hora: 120000 },
  { tipo_dia: 2, hora_inicio: '21:00', hora_fin: '22:00', precio_hora: 80000 },
  // ... etc
]);

// Opción B: Usar función helper para lunes a viernes
await configurarPrecioEstandar(1, {
  dias: [1, 2, 3, 4, 5], // Lunes a Viernes
  hora_apertura: '08:00',
  hora_cierre: '22:00',
  hora_pico_inicio: '18:00',
  hora_pico_fin: '21:00',
  precio_normal: 80000,
  precio_pico: 120000
});

// Opción C: Precio simple para todo el día (ej: Domingo)
await configurarPrecioSimple(1, 0, '10:00', '20:00', 100000);
```

### Caso 3: Consultar Precio Disponible (Función Principal)

```javascript
import { getAvailablePrice } from './services/horarios/horariosService.js';

// Consultar precio para una reserva
const resultado = await getAvailablePrice(
  1,                    // cancha_id
  '2026-04-14',         // fecha (lunes)
  '19:00'               // hora
);

console.log(resultado);
// {
//   disponible: true,
//   precio: 120000,
//   mensaje: 'Precio disponible',
//   detalles: {
//     cancha_id: 1,
//     cancha_nombre: 'Cancha Fútbol 5',
//     complejo_id: 1,
//     complejo_nombre: 'Complejo Los Andes',
//     dia_semana: 1,
//     hora: '19:00',
//     bloque_horario: { inicio: '18:00', fin: '21:00' },
//     horario_complejo: { ... }
//   }
// }

// Caso: Hora fuera de horario del complejo
const resultado2 = await getAvailablePrice(1, '2026-04-14', '23:00');
// {
//   disponible: false,
//   precio: null,
//   mensaje: 'Complejo cerrado. Horario: 08:00 - 22:00',
//   detalles: { ... }
// }

// Caso: Sin precio configurado
const resultado3 = await getAvailablePrice(1, '2026-04-14', '07:00');
// {
//   disponible: false,
//   precio: null,
//   mensaje: 'No hay precio configurado para este horario',
//   detalles: { ... }
// }
```

### Caso 4: Consultar Configuración Actual

```javascript
import { 
  getHorariosComplejo, 
  getPreciosPorCancha 
} from './services/horarios/horariosService.js';

// Ver horarios del complejo
const horariosComplejo = await getHorariosComplejo(1);
console.log(horariosComplejo);
// [
//   { dia_numero: 0, dia_nombre: 'Domingo', hora_apertura: '10:00', hora_cierre: '20:00', esta_cerrado: false },
//   { dia_numero: 1, dia_nombre: 'Lunes', hora_apertura: '08:00', hora_cierre: '22:00', esta_cerrado: false },
//   ...
// ]

// Ver precios de una cancha
const preciosCancha = await getPreciosPorCancha(1);
console.log(preciosCancha);
// [
//   {
//     dia_numero: 1,
//     dia_nombre: 'Lunes',
//     bloques: [
//       { hora_inicio: '08:00', hora_fin: '18:00', precio_hora: 80000 },
//       { hora_inicio: '18:00', hora_fin: '21:00', precio_hora: 120000 },
//       { hora_inicio: '21:00', hora_fin: '22:00', precio_hora: 80000 }
//     ]
//   },
//   ...
// ]
```

### Caso 5: Marcar Días Festivos o Mantenimiento

```javascript
import { marcarDiaCerrado } from './services/horarios/configuracionService.js';

// Cerrar el complejo los domingos
await marcarDiaCerrado(1, 0, true);  // complejo_id, dia_semana, cerrado

// Volver a abrir
await marcarDiaCerrado(1, 0, false);

// Ahora si alguien intenta reservar un domingo:
const resultado = await getAvailablePrice(1, '2026-04-13', '15:00'); // Domingo
// {
//   disponible: false,
//   precio: null,
//   mensaje: 'Complejo cerrado (festivo o mantenimiento)',
//   detalles: { ... }
// }
```

### Caso 6: Actualizar Configuración Existente

```javascript
import { 
  limpiarPreciosCancha,
  limpiarPreciosDia,
  configurarPreciosCancha 
} from './services/horarios/configuracionService.js';

// Opción A: Actualizar usando bulkCreate (recomendado)
// Los índices únicos evitan duplicados automáticamente
await configurarPreciosCancha(1, [
  { tipo_dia: 1, hora_inicio: '08:00', hora_fin: '18:00', precio_hora: 85000 }, // Precio actualizado
  { tipo_dia: 1, hora_inicio: '18:00', hora_fin: '21:00', precio_hora: 125000 }  // Precio actualizado
]);

// Opción B: Limpiar y reconfigurar un día específico
await limpiarPreciosDia(1, 1); // cancha_id, tipo_dia (lunes)
await configurarPreciosCancha(1, [
  { tipo_dia: 1, hora_inicio: '08:00', hora_fin: '22:00', precio_hora: 90000 }
]);

// Opción C: Limpiar toda la configuración de una cancha
await limpiarPreciosCancha(1);
// Luego reconfigurar desde cero...
```

## 🔧 Integración con Controlador de Reservas

```javascript
// En tu courtController.js o reservasController.js
import { getAvailablePrice } from './services/horarios/horariosService.js';

export async function crearReserva(req, res) {
  const { cancha_id, fecha, hora, duracion } = req.body;
  
  try {
    // Validar precio disponible
    const validacion = await getAvailablePrice(cancha_id, fecha, hora);
    
    if (!validacion.disponible) {
      return res.status(400).json({
        error: true,
        mensaje: validacion.mensaje,
        detalles: validacion.detalles
      });
    }
    
    // Calcular precio total
    const precioTotal = validacion.precio * duracion; // duracion en horas
    
    // Crear la reserva...
    const reserva = await Reservas.create({
      cancha_id,
      fecha,
      hora_inicio: hora,
      duracion,
      precio_total: precioTotal,
      // ... otros campos
    });
    
    return res.json({
      success: true,
      reserva,
      precio_hora: validacion.precio,
      precio_total: precioTotal
    });
    
  } catch (error) {
    return res.status(500).json({
      error: true,
      mensaje: error.message
    });
  }
}
```

## 📊 Ejemplos de Escenarios Reales

### Escenario 1: Complejo "Los Andes"

```javascript
// Jorge configura su complejo
await configurarComplejoCompleto({
  complejo_id: 1,
  horarios_complejo: {
    lun_vie_apertura: '06:00',
    lun_vie_cierre: '23:00',
    sab_apertura: '07:00',
    sab_cierre: '00:00', // Hasta medianoche
    dom_apertura: '08:00',
    dom_cierre: '22:00'
  },
  canchas: [
    {
      cancha_id: 1, // Fútbol 5 Premium
      precios_lun_vie: {
        hora_apertura: '06:00',
        hora_cierre: '23:00',
        hora_pico_inicio: '17:00',
        hora_pico_fin: '22:00',
        precio_normal: 70000,
        precio_pico: 120000
      },
      precios_sab: { hora_inicio: '07:00', hora_fin: '00:00', precio: 130000 },
      precios_dom: { hora_inicio: '08:00', hora_fin: '22:00', precio: 110000 }
    },
    {
      cancha_id: 2, // Fútbol 5 Estándar
      precios_lun_vie: {
        hora_apertura: '06:00',
        hora_cierre: '23:00',
        hora_pico_inicio: '17:00',
        hora_pico_fin: '22:00',
        precio_normal: 60000,
        precio_pico: 100000
      },
      precios_sab: { hora_inicio: '07:00', hora_fin: '00:00', precio: 110000 },
      precios_dom: { hora_inicio: '08:00', hora_fin: '22:00', precio: 90000 }
    }
  ]
});
```

### Escenario 2: Día Festivo

```javascript
// El 1 de enero es festivo - Jorge cierra el complejo
await marcarDiaCerrado(1, 1, true); // Lunes 1 de enero

// Cliente intenta reservar
const resultado = await getAvailablePrice(1, '2026-01-01', '10:00');
// → disponible: false, mensaje: 'Complejo cerrado (festivo o mantenimiento)'

// Después del festivo, Jorge reabre
await marcarDiaCerrado(1, 1, false);
```

### Escenario 3: Cambio de Precios en Temporada Alta

```javascript
// Jorge aumenta precios para diciembre (temporada alta)
// Actualiza solo los precios de horario pico
await configurarPreciosCancha(1, [
  { tipo_dia: 1, hora_inicio: '17:00', hora_fin: '22:00', precio_hora: 150000 }, // +30k
  { tipo_dia: 2, hora_inicio: '17:00', hora_fin: '22:00', precio_hora: 150000 },
  { tipo_dia: 3, hora_inicio: '17:00', hora_fin: '22:00', precio_hora: 150000 },
  { tipo_dia: 4, hora_inicio: '17:00', hora_fin: '22:00', precio_hora: 150000 },
  { tipo_dia: 5, hora_inicio: '17:00', hora_fin: '22:00', precio_hora: 150000 }
]);

// Los precios normales (06:00-17:00) permanecen sin cambios
```

## ⚠️ Notas Importantes

1. **Índices Únicos**: Asegúrate de ejecutar la migración SQL para crear los índices únicos. Sin ellos, `updateOnDuplicate` no funcionará correctamente.

2. **Formato de Hora**: Todas las horas deben estar en formato `HH:MM` o `HH:MM:SS`.

3. **Días de la Semana**: 
   - 0 = Domingo
   - 1 = Lunes
   - 2 = Martes
   - 3 = Miércoles
   - 4 = Jueves
   - 5 = Viernes
   - 6 = Sábado
   - 7 = Festivo (opcional, para el sistema El Híbrido)

4. **Rangos Horarios**: Los rangos son `[hora_inicio, hora_fin)` (inicio inclusivo, fin exclusivo).

5. **Transacciones**: Las funciones que modifican múltiples tablas usan transacciones para mantener consistencia.

6. **Performance**: Los índices aseguran que las consultas de validación sean rápidas incluso con miles de configuraciones.

## 🐛 Troubleshooting

### Error: "Duplicate entry"

```bash
# Verificar que los índices únicos estén creados
SHOW INDEX FROM complejo_horarios;
SHOW INDEX FROM cancha_horarios_precios;

# Si no existen, ejecutar la migración
mysql -u usuario -p nombre_bd < src/db/migrations/add_unique_indexes_horarios.sql
```

### No se actualiza la configuración

```javascript
// Asegúrate de estar usando updateOnDuplicate correctamente
// O limpia antes de reconfigurar
await limpiarPreciosCancha(cancha_id);
await configurarPreciosCancha(cancha_id, nuevosPrecios);
```

## 📞 Soporte

Para más información o dudas sobre la implementación, contactar al equipo de desarrollo de Zyra.
