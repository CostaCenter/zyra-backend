import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'zyra',
  user: 'postgres',
  password: '123'
});

async function migrar() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Verificar tabla actual
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reservas'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Columnas actuales en reservas:');
    checkColumns.rows.forEach(row => console.log('  -', row.column_name));

    // Ejecutar ALTER TABLE
    console.log('\n🔄 Agregando columnas...');
    
    await client.query(`
      ALTER TABLE reservas 
      ADD COLUMN IF NOT EXISTS origen_reserva VARCHAR(20) NOT NULL DEFAULT 'WEB'
    `);
    console.log('✓ origen_reserva');

    await client.query(`
      ALTER TABLE reservas 
      ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(20)
    `);
    console.log('✓ telefono_contacto');

    await client.query(`
      ALTER TABLE reservas 
      ADD COLUMN IF NOT EXISTS nombre_contacto VARCHAR(100)
    `);
    console.log('✓ nombre_contacto');

    // Verificar resultado
    const afterColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reservas'
        AND column_name IN ('origen_reserva', 'telefono_contacto', 'nombre_contacto');
    `);

    console.log('\n✅ Columnas nuevas creadas:');
    afterColumns.rows.forEach(row => console.log('  ✓', row.column_name));

    if (afterColumns.rows.length === 3) {
      console.log('\n🎉 MIGRACIÓN EXITOSA');
    } else {
      console.log('\n⚠️ FALTA ALGUNA COLUMNA');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

migrar().catch(console.error);
