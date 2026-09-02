import sequelize from './src/config/database.js';

async function ejecutarMigracion() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    
    await sequelize.authenticate();
    console.log('✅ Conexión establecida correctamente');
    
    console.log('🔄 Ejecutando migración...');
    
    // Ejecutar ALTER TABLE
    await sequelize.query(`
      ALTER TABLE reservas 
      ADD COLUMN IF NOT EXISTS origen_reserva VARCHAR(20) NOT NULL DEFAULT 'WEB',
      ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(20),
      ADD COLUMN IF NOT EXISTS nombre_contacto VARCHAR(100);
    `);
    
    console.log('✅ Migración ejecutada exitosamente');
    
    // Verificar que las columnas existen
    console.log('🔍 Verificando columnas...');
    
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'reservas'
        AND column_name IN ('origen_reserva', 'telefono_contacto', 'nombre_contacto')
      ORDER BY column_name;
    `);
    
    console.log('\n📋 Columnas creadas:');
    results.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    
    if (results.length === 3) {
      console.log('\n🎉 ¡Migración completada con éxito!');
    } else {
      console.log('\n⚠️ Advertencia: Solo se crearon', results.length, 'de 3 columnas');
    }
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Las columnas ya existen. No hay nada que hacer.');
    } else {
      console.error('Detalles del error:', error);
      process.exit(1);
    }
  } finally {
    await sequelize.close();
    console.log('\n👋 Conexión cerrada');
  }
}

// Ejecutar
ejecutarMigracion();
