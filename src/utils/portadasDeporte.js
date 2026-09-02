const PORTADAS = {
  futbol: [
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&h=900&q=80',
    'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1600&h=900&q=80',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&h=900&q=80',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1600&h=900&q=80',
  ],
  voley: [
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1600&h=900&q=80',
    'https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=1600&h=900&q=80',
    'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1600&h=900&q=80',
    'https://images.unsplash.com/photo-1612872085522-316dca827258?auto=format&fit=crop&w=1600&h=900&q=80',
  ],
  basquet: [
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&h=900&q=80',
    'https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1600&h=900&q=80',
  ],
};

const poolPorDeporte = (sportName = '') => {
  const key = String(sportName).toLowerCase();
  if (key.includes('futbol') || key.includes('fútbol') || key.includes('soccer')) {
    return PORTADAS.futbol;
  }
  if (key.includes('vole')) return PORTADAS.voley;
  if (key.includes('basquet') || key.includes('básquet') || key.includes('basket')) {
    return PORTADAS.basquet;
  }
  return PORTADAS.futbol;
};

export const urlPortadaPorDeporte = (sportName, seed = '') => {
  const pool = poolPorDeporte(sportName);
  const str = String(seed || sportName || 'torneo');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return pool[Math.abs(hash) % pool.length];
};
