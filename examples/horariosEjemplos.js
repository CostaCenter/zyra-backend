/**
 * EJEMPLOS PRÁCTICOS - Sistema de Horarios y Precios Zyra
 * 
 * Este archivo contiene ejemplos completos de uso del sistema.
 * Puedes ejecutar estos ejemplos directamente o usarlos como referencia.
 */

import {
  configurarComplejoCompleto,
  configurarHorariosComplejo,
  configurarHorarioEstandar,
  configurarPreciosCancha,
  configurarPrecioEstandar,
  configurarPrecioSimple,
  marcarDiaCerrado,
  limpiarPreciosCancha,
  limpiarPreciosDia
} from '../services/horarios/configuracionService.js';

import {
  getAvailablePrice,
  verificarComplejoAbierto,
  getPreciosPorCancha,
  getHorariosComplejo
} from '../services/horarios/horariosService.js';

// ============================================
// EJEMPLO 1: CONFIGURACIÓN INICIAL COMPLETA
// ============================================

export async function ejemplo1_ConfiguracionInicial() {
  console.log('\n=== EJEMPLO 1: Configuración Inicial Completa ===\n');

  try {
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
      
      // Configuración de 2 canchas
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
          precios_sab: { 
            hora_inicio: '09:00', 
            hora_fin: '23:00', 
            precio: 100000 
          },
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

    console.log('✅ Configuración completa exitosa:');
    console.log(`   - Horarios del complejo: ${resultado.horarios_complejo} registros`);
    console.log(`   - Canchas configuradas: ${resultado.canchas_configuradas}`);
    console.log('\n', resultado);

    return resultado;

  } catch (error) {
    console.error('❌ Error en configuración:', error.message);
    throw error;
  }
}

// ============================================
// EJEMPLO 2: CONSULTAR PRECIO DISPONIBLE
// ============================================

export async function ejemplo2_ConsultarPrecios() {
  console.log('\n=== EJEMPLO 2: Consultar Precios Disponibles ===\n');

  // Caso A: Hora dentro del horario pico (debe ser más cara)
  console.log('📍 Caso A: Lunes 19:00 (horario pico)');
  const precio1 = await getAvailablePrice(1, '2026-04-14', '19:00');
  console.log(`   Disponible: ${precio1.disponible}`);
  console.log(`   Precio: $${precio1.precio?.toLocaleString('es-CO')}`);
  console.log(`   Mensaje: ${precio1.mensaje}`);
  console.log(`   Bloque: ${precio1.detalles?.bloque_horario?.inicio} - ${precio1.detalles?.bloque_horario?.fin}`);

  // Caso B: Hora fuera del horario pico (debe ser más barata)
  console.log('\n📍 Caso B: Lunes 15:00 (horario normal)');
  const precio2 = await getAvailablePrice(1, '2026-04-14', '15:00');
  console.log(`   Disponible: ${precio2.disponible}`);
  console.log(`   Precio: $${precio2.precio?.toLocaleString('es-CO')}`);
  console.log(`   Mensaje: ${precio2.mensaje}`);

  // Caso C: Domingo
  console.log('\n📍 Caso C: Domingo 15:00');
  const precio3 = await getAvailablePrice(1, '2026-04-13', '15:00');
  console.log(`   Disponible: ${precio3.disponible}`);
  console.log(`   Precio: $${precio3.precio?.toLocaleString('es-CO')}`);
  console.log(`   Mensaje: ${precio3.mensaje}`);

  // Caso D: Hora fuera del horario del complejo
  console.log('\n📍 Caso D: Lunes 23:00 (complejo cerrado)');
  const precio4 = await getAvailablePrice(1, '2026-04-14', '23:00');
  console.log(`   Disponible: ${precio4.disponible}`);
  console.log(`   Precio: ${precio4.precio}`);
  console.log(`   Mensaje: ${precio4.mensaje}`);

  // Caso E: Hora sin precio configurado
  console.log('\n📍 Caso E: Lunes 07:00 (sin precio configurado)');
  const precio5 = await getAvailablePrice(1, '2026-04-14', '07:00');
  console.log(`   Disponible: ${precio5.disponible}`);
  console.log(`   Precio: ${precio5.precio}`);
  console.log(`   Mensaje: ${precio5.mensaje}`);
}

// ============================================
// EJEMPLO 3: CONFIGURACIÓN PASO A PASO
// ============================================

export async function ejemplo3_ConfiguracionPorPartes() {
  console.log('\n=== EJEMPLO 3: Configuración Paso a Paso ===\n');

  const complejo_id = 2;
  const cancha_id = 3;

  try {
    // Paso 1: Configurar horarios del complejo
    console.log('📝 Paso 1: Configurando horarios del complejo...');
    await configurarHorarioEstandar(complejo_id, {
      lun_vie_apertura: '06:00',
      lun_vie_cierre: '23:00',
      sab_apertura: '07:00',
      sab_cierre: '00:00',
      dom_apertura: '08:00',
      dom_cierre: '22:00'
    });
    console.log('   ✅ Horarios del complejo configurados');

    // Paso 2: Configurar precios de lunes a viernes
    console.log('\n📝 Paso 2: Configurando precios lunes a viernes...');
    await configurarPrecioEstandar(cancha_id, {
      dias: [1, 2, 3, 4, 5],
      hora_apertura: '06:00',
      hora_cierre: '23:00',
      hora_pico_inicio: '17:00',
      hora_pico_fin: '22:00',
      precio_normal: 75000,
      precio_pico: 130000
    });
    console.log('   ✅ Precios lunes a viernes configurados');

    // Paso 3: Configurar sábado
    console.log('\n📝 Paso 3: Configurando precio sábado...');
    await configurarPrecioSimple(cancha_id, 6, '07:00', '00:00', 140000);
    console.log('   ✅ Precio sábado configurado');

    // Paso 4: Configurar domingo
    console.log('\n📝 Paso 4: Configurando precio domingo...');
    await configurarPrecioSimple(cancha_id, 0, '08:00', '22:00', 120000);
    console.log('   ✅ Precio domingo configurado');

    console.log('\n🎉 Configuración completa exitosa!');

    // Verificar configuración
    const horarios = await getHorariosComplejo(complejo_id);
    const precios = await getPreciosPorCancha(cancha_id);
    
    console.log('\n📊 Resumen de configuración:');
    console.log(`   - Días con horario: ${horarios.length}`);
    console.log(`   - Días con precios: ${precios.length}`);

  } catch (error) {
    console.error('❌ Error en configuración:', error.message);
    throw error;
  }
}

// ============================================
// EJEMPLO 4: MANEJO DE DÍAS FESTIVOS
// ============================================

export async function ejemplo4_DiasFestivos() {
  console.log('\n=== EJEMPLO 4: Manejo de Días Festivos ===\n');

  const complejo_id = 1;
  const cancha_id = 1;

  try {
    // Marcar lunes como cerrado (simulando festivo)
    console.log('📅 Marcando lunes como día cerrado (festivo)...');
    await marcarDiaCerrado(complejo_id, 1, true);
    console.log('   ✅ Lunes marcado como cerrado');

    // Intentar consultar precio
    console.log('\n🔍 Intentando reservar en día festivo...');
    const resultado = await getAvailablePrice(cancha_id, '2026-04-14', '15:00'); // Lunes
    console.log(`   Disponible: ${resultado.disponible}`);
    console.log(`   Mensaje: ${resultado.mensaje}`);

    // Reabrir el día
    console.log('\n🔓 Reabriendo el lunes...');
    await marcarDiaCerrado(complejo_id, 1, false);
    console.log('   ✅ Lunes reabierto');

    // Intentar de nuevo
    console.log('\n🔍 Intentando reservar nuevamente...');
    const resultado2 = await getAvailablePrice(cancha_id, '2026-04-14', '15:00');
    console.log(`   Disponible: ${resultado2.disponible}`);
    console.log(`   Precio: $${resultado2.precio?.toLocaleString('es-CO')}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// ============================================
// EJEMPLO 5: ACTUALIZAR PRECIOS EXISTENTES
// ============================================

export async function ejemplo5_ActualizarPrecios() {
  console.log('\n=== EJEMPLO 5: Actualizar Precios Existentes ===\n');

  const cancha_id = 1;

  try {
    // Ver precios actuales
    console.log('📊 Precios actuales de la cancha:');
    const preciosActuales = await getPreciosPorCancha(cancha_id);
    console.log(JSON.stringify(preciosActuales[0], null, 2));

    // Actualizar solo el horario pico de lunes
    console.log('\n💰 Aumentando precio del horario pico de lunes...');
    await configurarPreciosCancha(cancha_id, [
      { tipo_dia: 1, hora_inicio: '18:00', hora_fin: '21:00', precio_hora: 150000 }
    ]);
    console.log('   ✅ Precio actualizado a $150,000');

    // Verificar cambio
    console.log('\n🔍 Verificando nuevo precio...');
    const nuevoPrecio = await getAvailablePrice(cancha_id, '2026-04-14', '19:00');
    console.log(`   Nuevo precio: $${nuevoPrecio.precio?.toLocaleString('es-CO')}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// ============================================
// EJEMPLO 6: LIMPIAR Y RECONFIGURAR
// ============================================

export async function ejemplo6_LimpiarYReconfigurar() {
  console.log('\n=== EJEMPLO 6: Limpiar y Reconfigurar ===\n');

  const cancha_id = 2;

  try {
    // Ver configuración actual
    console.log('📊 Configuración actual:');
    const preciosActuales = await getPreciosPorCancha(cancha_id);
    console.log(`   - Total de días configurados: ${preciosActuales.length}`);

    // Limpiar solo el lunes
    console.log('\n🧹 Limpiando configuración del lunes...');
    const eliminados = await limpiarPreciosDia(cancha_id, 1);
    console.log(`   ✅ ${eliminados} registros eliminados`);

    // Reconfigurar lunes con precio único todo el día
    console.log('\n💰 Reconfigurando lunes con precio único...');
    await configurarPrecioSimple(cancha_id, 1, '08:00', '22:00', 95000);
    console.log('   ✅ Lunes reconfigurado: $95,000 todo el día');

    // Verificar
    const nuevosPrecios = await getPreciosPorCancha(cancha_id);
    const preciosLunes = nuevosPrecios.find(p => p.dia_numero === 1);
    console.log('\n📊 Nueva configuración del lunes:');
    console.log(JSON.stringify(preciosLunes, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// ============================================
// EJEMPLO 7: CONSULTAR CONFIGURACIÓN
// ============================================

export async function ejemplo7_ConsultarConfiguracion() {
  console.log('\n=== EJEMPLO 7: Consultar Configuración ===\n');

  const complejo_id = 1;
  const cancha_id = 1;

  try {
    // Consultar horarios del complejo
    console.log('🕐 Horarios del Complejo:');
    const horarios = await getHorariosComplejo(complejo_id);
    horarios.forEach(h => {
      const estado = h.esta_cerrado ? '❌ CERRADO' : '✅ ABIERTO';
      console.log(`   ${h.dia_nombre}: ${h.hora_apertura} - ${h.hora_cierre} ${estado}`);
    });

    // Consultar precios de la cancha
    console.log('\n💰 Precios de la Cancha:');
    const precios = await getPreciosPorCancha(cancha_id);
    precios.forEach(dia => {
      console.log(`\n   ${dia.dia_nombre}:`);
      dia.bloques.forEach(bloque => {
        console.log(`     ${bloque.hora_inicio} - ${bloque.hora_fin}: $${bloque.precio_hora.toLocaleString('es-CO')}`);
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// ============================================
// EJEMPLO 8: SIMULACIÓN DE RESERVA COMPLETA
// ============================================

export async function ejemplo8_SimulacionReserva() {
  console.log('\n=== EJEMPLO 8: Simulación de Reserva Completa ===\n');

  const cancha_id = 1;
  const fecha = '2026-04-15'; // Martes
  const hora = '19:00';
  const duracion = 2; // 2 horas

  try {
    console.log('🎯 Datos de la reserva:');
    console.log(`   - Cancha: ${cancha_id}`);
    console.log(`   - Fecha: ${fecha}`);
    console.log(`   - Hora: ${hora}`);
    console.log(`   - Duración: ${duracion} horas`);

    // Validar disponibilidad y precio
    console.log('\n🔍 Validando disponibilidad...');
    const validacion = await getAvailablePrice(cancha_id, fecha, hora);

    if (!validacion.disponible) {
      console.log(`   ❌ Reserva no disponible: ${validacion.mensaje}`);
      return;
    }

    console.log(`   ✅ Disponible!`);
    console.log(`   - Precio por hora: $${validacion.precio.toLocaleString('es-CO')}`);
    console.log(`   - Complejo: ${validacion.detalles.complejo_nombre}`);
    console.log(`   - Cancha: ${validacion.detalles.cancha_nombre}`);

    // Calcular precio total
    const precioTotal = validacion.precio * duracion;
    console.log(`\n💵 Cálculo del precio total:`);
    console.log(`   $${validacion.precio.toLocaleString('es-CO')} x ${duracion} horas = $${precioTotal.toLocaleString('es-CO')}`);

    console.log('\n✅ La reserva puede proceder con los siguientes datos:');
    console.log({
      cancha_id,
      fecha,
      hora_inicio: hora,
      duracion,
      precio_hora: validacion.precio,
      precio_total: precioTotal,
      bloque_horario: validacion.detalles.bloque_horario
    });

  } catch (error) {
    console.error('❌ Error en simulación:', error.message);
    throw error;
  }
}

// ============================================
// FUNCIÓN PARA EJECUTAR TODOS LOS EJEMPLOS
// ============================================

export async function ejecutarTodosLosEjemplos() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   EJEMPLOS DEL SISTEMA DE HORARIOS Y PRECIOS - ZYRA  ');
  console.log('═══════════════════════════════════════════════════════');

  try {
    await ejemplo1_ConfiguracionInicial();
    await ejemplo2_ConsultarPrecios();
    await ejemplo3_ConfiguracionPorPartes();
    await ejemplo4_DiasFestivos();
    await ejemplo5_ActualizarPrecios();
    await ejemplo6_LimpiarYReconfigurar();
    await ejemplo7_ConsultarConfiguracion();
    await ejemplo8_SimulacionReserva();

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   ✅ TODOS LOS EJEMPLOS EJECUTADOS EXITOSAMENTE     ');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error ejecutando ejemplos:', error);
    throw error;
  }
}

// Descomentar para ejecutar todos los ejemplos
// ejecutarTodosLosEjemplos();
