/**
 * Seed en preDeploy (Railway, URL internal OK).
 * Solo importa si sports está vacío.
 */
import '../src/config/loadEnv.js';
import { seedProductionIfEmpty } from '../src/utils/seedProductionIfEmpty.js';

await seedProductionIfEmpty();
console.log('🏁 run-seed-production terminado');
