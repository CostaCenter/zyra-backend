import { sequelize } from '../src/db/db.js';

const [maxRows] = await sequelize.query('SELECT MAX(id)::int AS m FROM "user"');
const [seqRows] = await sequelize.query(`
  SELECT pg_get_serial_sequence('"user"', 'id') AS seq_name
`);
const seqName = seqRows[0]?.seq_name;
let lastValue = null;
if (seqName) {
  const [lv] = await sequelize.query(`SELECT last_value FROM ${seqName}`);
  lastValue = lv[0]?.last_value;
}
console.log({ maxUserId: maxRows[0]?.m, seqName, lastValue });
await sequelize.close();
