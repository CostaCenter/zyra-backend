import sequelize from '../src/config/database.js';

try {
  const [db] = await sequelize.query('SELECT current_database() AS db, inet_server_addr() AS host');
  console.log('Conectado a:', db[0]);
  const [seq] = await sequelize.query(`SELECT last_value FROM "Team_id_seq"`);
  console.log('Secuencia Team_id_seq:', seq[0]);
} finally {
  await sequelize.close();
}
