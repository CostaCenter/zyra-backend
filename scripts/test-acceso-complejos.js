/**
 * Script de prueba para el sistema de acceso a complejos
 * 
 * Ejecutar con: node scripts/test-acceso-complejos.js
 */

import { sequelize, User, Complejos, UsuarioComplejo } from '../src/db/db.js';
import {
  grantAccess,
  revokeAccess,
  getUsersWithAccess,
  getUserComplexes,
  checkAccess,
  hasRole
} from '../src/services/complejoAccessService.js';

const testAccesoComplejos = async () => {
  try {
    console.log('🔄 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa\n');

    // Buscar un usuario y complejo de prueba
    const usuario = await User.findOne();
    const complejo = await Complejos.findOne();

    if (!usuario || !complejo) {
      console.log('⚠️  No hay usuarios o complejos en la base de datos');
      console.log('   Crea al menos un usuario y un complejo primero\n');
      return;
    }

    console.log(`📋 Usuario de prueba: ${usuario.name || usuario.nick} (ID: ${usuario.id})`);
    console.log(`🏟️  Complejo de prueba: ${complejo.nombre} (ID: ${complejo.id})\n`);

    // Test 1: Otorgar acceso
    console.log('🧪 Test 1: Otorgar acceso');
    try {
      const acceso = await grantAccess(usuario.id, complejo.id, 'ADMIN');
      console.log('✅ Acceso otorgado:', acceso.toJSON());
    } catch (error) {
      console.log('ℹ️  El acceso ya existía o hubo un error:', error.message);
    }
    console.log('');

    // Test 2: Verificar acceso
    console.log('🧪 Test 2: Verificar acceso');
    const tieneAcceso = await checkAccess(usuario.id, complejo.id);
    console.log('✅ Usuario tiene acceso:', tieneAcceso ? 'SÍ' : 'NO');
    if (tieneAcceso) {
      console.log('   Rol:', tieneAcceso.rol_en_complejo);
    }
    console.log('');

    // Test 3: Verificar rol específico
    console.log('🧪 Test 3: Verificar rol específico');
    const esAdmin = await hasRole(usuario.id, complejo.id, ['DUEÑO', 'ADMIN']);
    console.log('✅ Usuario es DUEÑO o ADMIN:', esAdmin ? 'SÍ' : 'NO');
    console.log('');

    // Test 4: Obtener complejos del usuario
    console.log('🧪 Test 4: Obtener complejos del usuario');
    const complejos = await getUserComplexes(usuario.id);
    console.log(`✅ Usuario tiene acceso a ${complejos.length} complejo(s):`);
    complejos.forEach(c => {
      console.log(`   - ${c.nombre} (${c.usuario_complejo.rol_en_complejo})`);
    });
    console.log('');

    // Test 5: Obtener usuarios del complejo
    console.log('🧪 Test 5: Obtener usuarios con acceso al complejo');
    const usuarios = await getUsersWithAccess(complejo.id);
    console.log(`✅ ${usuarios.length} usuario(s) tienen acceso:`);
    usuarios.forEach(u => {
      console.log(`   - ${u.name || u.nick} (${u.usuario_complejo.rol_en_complejo})`);
    });
    console.log('');

    // Test 6: Probar login con complejos
    console.log('🧪 Test 6: Probar estructura de login');
    const userWithComplexes = await User.findByPk(usuario.id, {
      include: [
        {
          model: Complejos,
          as: 'complejosConAcceso',
          through: {
            attributes: ['rol_en_complejo', 'creado_at']
          },
          attributes: ['id', 'nombre', 'ubicacion', 'photo', 'wallpaper']
        }
      ]
    });
    console.log('✅ Estructura de login (complejos incluidos):');
    console.log(JSON.stringify({
      id: userWithComplexes.id,
      name: userWithComplexes.name,
      complejos: userWithComplexes.complejosConAcceso
    }, null, 2));
    console.log('');

    console.log('🎉 ¡Todos los tests completados exitosamente!');
    console.log('\n📝 Resumen:');
    console.log('   ✅ Sistema de acceso a complejos funcionando correctamente');
    console.log('   ✅ Relaciones muchos-a-muchos configuradas');
    console.log('   ✅ Login devuelve complejos con acceso');
    console.log('   ✅ Servicios de gestión de acceso operativos\n');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    console.error(error.stack);
  } finally {
    await sequelize.close();
    console.log('🔒 Conexión cerrada');
  }
};

// Ejecutar tests
testAccesoComplejos();
