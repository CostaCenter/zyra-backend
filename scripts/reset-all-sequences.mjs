import { resetPgSequences } from '../src/utils/resetPgSequences.js';

const count = await resetPgSequences();
console.log(`✅ Secuencias sincronizadas (${count} tablas)`);
process.exit(0);
