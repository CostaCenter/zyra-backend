import { DataTypes } from 'sequelize';
import { sequelize } from '../db/db.js';

/**
 * Migración: Agregar campo origen_reserva a la tabla reservas
 * 
 * Permite identificar de dónde provino la reserva:
 * - MANUAL: Creada por administrador desde dashboard
 * - WEB: Creada por cliente desde aplicación web
 * - APP: Creada por cliente desde aplicación móvil
 * - API: Creada por integración externa
 */

export async function up() {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    await queryInterface.addColumn('reservas', 'origen_reserva', {
      type: DataTypes.STRING(20),
      defaultValue: 'WEB',
      comment: 'Origen de la reserva: MANUAL, WEB, APP, API',
      allowNull: false
    });

    await queryInterface.addColumn('reservas', 'telefono_contacto', {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Teléfono de contacto para reservas manuales sin user_id'
    });

    await queryInterface.addColumn('reservas', 'nombre_contacto', {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nombre de contacto para reservas manuales sin user_id'
    });

    console.log('✅ Columnas agregadas exitosamente');
  } catch (error) {
    console.error('❌ Error al agregar columnas:', error);
    throw error;
  }
}

export async function down() {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    await queryInterface.removeColumn('reservas', 'origen_reserva');
    await queryInterface.removeColumn('reservas', 'telefono_contacto');
    await queryInterface.removeColumn('reservas', 'nombre_contacto');
    
    console.log('✅ Columnas eliminadas exitosamente');
  } catch (error) {
    console.error('❌ Error al eliminar columnas:', error);
    throw error;
  }
}

// Ejecutar migración si se corre directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  up()
    .then(() => {
      console.log('Migración completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error en migración:', error);
      process.exit(1);
    });
}
