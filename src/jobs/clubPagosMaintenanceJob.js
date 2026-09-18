import { ejecutarMantenimientoPagosClub } from '../services/clubPagosUniformesService.js';

const INTERVAL_MS = 6 * 60 * 60 * 1000;

let intervalId = null;

export function iniciarClubPagosMaintenanceJob() {
  const run = async () => {
    try {
      const { vencidos, generados, avisos } = await ejecutarMantenimientoPagosClub();
      if (vencidos > 0 || generados > 0 || avisos > 0) {
        console.log(`[ClubPagosJob] vencidos=${vencidos} generados=${generados} avisos=${avisos}`);
      }
    } catch (error) {
      console.error('[ClubPagosJob] Error:', error.message || error);
    }
  };

  void run();
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(run, INTERVAL_MS);
}
