/**
 * TESTS BÁSICOS - Sistema de Horarios y Precios
 * 
 * Pruebas manuales para validar el funcionamiento del sistema.
 * Ejecutar después de la migración SQL.
 */

import { sequelize } from '../../src/db/db.js';
import {
  getAvailablePrice,
  configurarComplejoCompleto,
  limpiarHorariosComplejo,
  limpiarPreciosCancha
} from '../../src/services/horarios/index.js';

// ============================================
// CONFIGURACIÓN DE TEST
// ============================================

const TEST_CONFIG = {
  complejo_id: 999, // ID de prueba (no afecta producción)
  cancha_id: 999
};

// ============================================
// TESTS
// ============================================

async function test1_VerificarConexion() {
  console.log('\n🔍 TEST 1: Verificar conexión a BD');
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return false;
  }
}

async function test2_ConfigurarComplejo() {
  console.log('\n🔍 TEST 2: Configurar complejo de prueba');
  try {
    const resultado = await configurarComplejoCompleto({
      complejo_id: TEST_CONFIG.complejo_id,
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
          cancha_id: TEST_CONFIG.cancha_id,
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
        }
      ]
    });
    
    console.log('✅ Complejo configurado correctamente');
    console.log(`   - Horarios: ${resultado.horarios_complejo}`);
    console.log(`   - Canchas: ${resultado.canchas_configuradas}`);
    return true;
  } catch (error) {
    console.error('❌ Error configurando:', error.message);
    return false;
  }
}

async function test3_ConsultarPrecioNormal() {
  console.log('\n🔍 TEST 3: Consultar precio horario normal');
  try {
    const resultado = await getAvailablePrice(
      TEST_CONFIG.cancha_id,
      '2026-04-14', // Lunes
      '15:00'       // Horario normal
    );
    
    if (resultado.disponible && resultado.precio === 80000) {
      console.log('✅ Precio correcto: $80,000');
      return true;
    } else {
      console.error('❌ Precio incorrecto:', resultado);
      return false;
    }
  } catch (error) {
    console.error('❌ Error consultando:', error.message);
    return false;
  }
}

async function test4_ConsultarPrecioPico() {
  console.log('\n🔍 TEST 4: Consultar precio horario pico');
  try {
    const resultado = await getAvailablePrice(
      TEST_CONFIG.cancha_id,
      '2026-04-14', // Lunes
      '19:00'       // Horario pico
    );
    
    if (resultado.disponible && resultado.precio === 120000) {
      console.log('✅ Precio correcto: $120,000');
      return true;
    } else {
      console.error('❌ Precio incorrecto:', resultado);
      return false;
    }
  } catch (error) {
    console.error('❌ Error consultando:', error.message);
    return false;
  }
}

async function test5_HoraFueraDeRango() {
  console.log('\n🔍 TEST 5: Consultar hora fuera de rango');
  try {
    const resultado = await getAvailablePrice(
      TEST_CONFIG.cancha_id,
      '2026-04-14', // Lunes
      '23:00'       // Complejo cerrado
    );
    
    if (!resultado.disponible && resultado.mensaje.includes('cerrado')) {
      console.log('✅ Validación correcta: Complejo cerrado');
      return true;
    } else {
      console.error('❌ Validación incorrecta:', resultado);
      return false;
    }
  } catch (error) {
    console.error('❌ Error consultando:', error.message);
    return false;
  }
}

async function test6_PrecioDomingo() {
  console.log('\n🔍 TEST 6: Consultar precio domingo');
  try {
    const resultado = await getAvailablePrice(
      TEST_CONFIG.cancha_id,
      '2026-04-13', // Domingo
      '15:00'
    );
    
    if (resultado.disponible && resultado.precio === 100000) {
      console.log('✅ Precio correcto: $100,000');
      return true;
    } else {
      console.error('❌ Precio incorrecto:', resultado);
      return false;
    }
  } catch (error) {
    console.error('❌ Error consultando:', error.message);
    return false;
  }
}

async function testCleanup_LimpiarDatosPrueba() {
  console.log('\n🧹 CLEANUP: Limpiando datos de prueba');
  try {
    await limpiarPreciosCancha(TEST_CONFIG.cancha_id);
    await limpiarHorariosComplejo(TEST_CONFIG.complejo_id);
    console.log('✅ Datos de prueba limpiados');
    return true;
  } catch (error) {
    console.error('❌ Error limpiando:', error.message);
    return false;
  }
}

// ============================================
// EJECUTAR TODOS LOS TESTS
// ============================================

async function ejecutarTests() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   TESTS DEL SISTEMA DE HORARIOS Y PRECIOS - ZYRA    ');
  console.log('═══════════════════════════════════════════════════════');
  
  const resultados = [];
  
  try {
    // Tests
    resultados.push({ nombre: 'Verificar Conexión', resultado: await test1_VerificarConexion() });
    resultados.push({ nombre: 'Configurar Complejo', resultado: await test2_ConfigurarComplejo() });
    resultados.push({ nombre: 'Precio Horario Normal', resultado: await test3_ConsultarPrecioNormal() });
    resultados.push({ nombre: 'Precio Horario Pico', resultado: await test4_ConsultarPrecioPico() });
    resultados.push({ nombre: 'Hora Fuera de Rango', resultado: await test5_HoraFueraDeRango() });
    resultados.push({ nombre: 'Precio Domingo', resultado: await test6_PrecioDomingo() });
    
    // Cleanup
    await testCleanup_LimpiarDatosPrueba();
    
    // Resumen
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   RESUMEN DE TESTS                                   ');
    console.log('═══════════════════════════════════════════════════════');
    
    let exitosos = 0;
    let fallidos = 0;
    
    resultados.forEach(r => {
      const icono = r.resultado ? '✅' : '❌';
      console.log(`${icono} ${r.nombre}`);
      if (r.resultado) exitosos++;
      else fallidos++;
    });
    
    console.log('\n');
    console.log(`Total: ${resultados.length} tests`);
    console.log(`Exitosos: ${exitosos}`);
    console.log(`Fallidos: ${fallidos}`);
    console.log('\n');
    
    if (fallidos === 0) {
      console.log('🎉 ¡TODOS LOS TESTS PASARON! Sistema funcionando correctamente.');
    } else {
      console.log('⚠️  Algunos tests fallaron. Revisar configuración.');
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ Error ejecutando tests:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar tests
ejecutarTests();
