/**
 * Seed en preDeploy (Railway, URL internal OK).
 * Solo importa si sports está vacío.
 */
import '../src/config/loadEnv.js';
import { seedProductionIfEmpty } from '../src/utils/seedProductionIfEmpty.js';
import { seedVictoryPlantelIfNeeded } from '../src/utils/seedVictoryPlantel.js';

await seedProductionIfEmpty();
try {
  await seedVictoryPlantelIfNeeded();
} catch (err) {
  console.error('❌ Seed Victory falló:', err.message || err);
  throw err;
}
console.log('🏁 run-seed-production terminado');
