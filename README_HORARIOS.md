# Sistema de Horarios y Precios - Zyra ⚡

Sistema jerárquico de gestión de horarios y precios para complejos deportivos.

## 🚀 Inicio Rápido

```javascript
import { getAvailablePrice, configurarComplejoCompleto } from './src/services/horarios/index.js';

// 1. Configurar complejo (solo una vez)
await configurarComplejoCompleto({
  complejo_id: 1,
  horarios_complejo: {
    lun_vie_apertura: '08:00',
    lun_vie_cierre: '22:00',
    sab_apertura: '09:00',
    sab_cierre: '23:00',
    dom_apertura: '10:00',
    dom_cierre: '20:00'
  },
  canchas: [
    {
      cancha_id: 1,
      precios_lun_vie: {
        hora_apertura: '08:00',
        hora_cierre: '22:00',
        hora_pico_inicio: '18:00',
        hora_pico_fin: '21:00',
        precio_normal: 80000,
        precio_pico: 120000
      },
      precios_sab: { hora_inicio: '09:00', hora_fin: '23:00', precio: 100000 },
      precios_dom: { hora_inicio: '10:00', hora_fin: '20:00', precio: 100000 }
    }
  ]
});

// 2. Validar disponibilidad y obtener precio
const resultado = await getAvailablePrice(1, '2026-04-14', '19:00');

if (resultado.disponible) {
  console.log(`Precio: $${resultado.precio}`);
  // Proceder con la reserva...
} else {
  console.log(`No disponible: ${resultado.mensaje}`);
}
```

## 📚 Documentación

- **[Documentación Completa](./docs/HORARIOS_Y_PRECIOS.md)** - Guía detallada con todos los casos de uso
- **[Ejemplos Prácticos](./examples/horariosEjemplos.js)** - Código ejecutable con 8 ejemplos

## 🏗️ Estructura

```
src/services/horarios/
├── horariosService.js          # Validación y consultas
├── configuracionService.js     # Configuración masiva
└── index.js                    # Exportaciones

src/db/migrations/
└── add_unique_indexes_horarios.sql  # Migración SQL requerida

docs/
└── HORARIOS_Y_PRECIOS.md       # Documentación completa

examples/
└── horariosEjemplos.js         # 8 ejemplos prácticos
```

## ⚙️ Instalación

### 1. Ejecutar migración SQL

```bash
mysql -u usuario -p nombre_bd < src/db/migrations/add_unique_indexes_horarios.sql
```

### 2. Importar servicios

```javascript
import { getAvailablePrice, configurarComplejoCompleto } from './src/services/horarios/index.js';
```

## 🎯 Funciones Principales

### Validación

- `getAvailablePrice(cancha_id, fecha, hora)` - **Función principal** para validar y obtener precio
- `verificarComplejoAbierto(complejo_id, dia_semana, hora)` - Verificar si el complejo está abierto
- `getPreciosPorCancha(cancha_id)` - Consultar todos los precios de una cancha
- `getHorariosComplejo(complejo_id)` - Consultar horarios del complejo

### Configuración

- `configurarComplejoCompleto(config)` - Configurar complejo completo de una vez
- `configurarHorarioEstandar(complejo_id, config)` - Configurar horario L-V / Sab / Dom
- `configurarPrecioEstandar(cancha_id, config)` - Configurar precio normal/pico
- `configurarPrecioSimple(cancha_id, dia, inicio, fin, precio)` - Precio único todo el día
- `marcarDiaCerrado(complejo_id, dia_semana, cerrado)` - Manejar festivos

## 💡 Casos de Uso

### Caso 1: Validar Reserva

```javascript
const validacion = await getAvailablePrice(1, '2026-04-14', '19:00');

if (validacion.disponible) {
  const precioTotal = validacion.precio * 2; // 2 horas
  // Crear reserva...
}
```

### Caso 2: Día Festivo

```javascript
// Cerrar por festivo
await marcarDiaCerrado(1, 1, true); // Cerrar lunes

// Reabrir
await marcarDiaCerrado(1, 1, false);
```

### Caso 3: Cambiar Precios

```javascript
// Actualizar precio horario pico
await configurarPreciosCancha(1, [
  { tipo_dia: 1, hora_inicio: '18:00', hora_fin: '21:00', precio_hora: 150000 }
]);
```

## 📊 Días de la Semana

- `0` = Domingo
- `1` = Lunes
- `2` = Martes
- `3` = Miércoles
- `4` = Jueves
- `5` = Viernes
- `6` = Sábado
- `7` = Festivo (opcional)

## 🔧 Características

- ✅ Validación jerárquica (complejo → cancha)
- ✅ Configuración masiva con `bulkCreate`
- ✅ Índices únicos para evitar duplicados
- ✅ Soporte para horarios pico
- ✅ Manejo de días festivos
- ✅ Transacciones para consistencia
- ✅ 100% ESM (.js)

## 📝 Notas

1. **Ejecutar migración SQL primero** para crear índices únicos
2. Formato de hora: `HH:MM` o `HH:MM:SS`
3. Rangos horarios: `[hora_inicio, hora_fin)` (inicio inclusivo, fin exclusivo)
4. `updateOnDuplicate` requiere índices únicos para funcionar

## 🐛 Troubleshooting

```bash
# Verificar índices
SHOW INDEX FROM complejo_horarios;
SHOW INDEX FROM cancha_horarios_precios;
```

## 📞 Soporte

Ver [documentación completa](./docs/HORARIOS_Y_PRECIOS.md) para más detalles.
