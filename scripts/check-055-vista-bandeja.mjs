import sequelize from '../src/config/database.js';

const [rows] = await sequelize.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'notificaciones'
    AND column_name IN ('vista_bandeja', 'leida')
  ORDER BY column_name
`);
console.log(rows);
await sequelize.close();
