/**
 * Agrega jugadores al club Victory vía API de producción.
 * Uso:
 *   $env:ADMIN_TELEFONO="3001234567"
 *   $env:ADMIN_PASSWORD="tu_password"
 *   node scripts/seed-victory-via-api.mjs
 */
const API_BASE = process.env.API_BASE_URL || 'https://web-production-ed7ea.up.railway.app';
const CLUB_QUERY = (process.env.CLUB_NAME || 'victo').toLowerCase();
const JUGADORES = Number(process.env.JUGADORES_A_AGREGAR || 15);

const POSICIONES = [
  'ARMADOR', 'PUNTA', 'CENTRAL', 'OPUESTO', 'PUNTA',
  'CENTRAL', 'LÍBERO', 'PUNTA', 'ARMADOR', 'CENTRAL',
  'OPUESTO', 'PUNTA', 'CENTRAL', 'PUNTA', 'CENTRAL',
];

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.message || data?.raw || res.statusText;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function login(telefono, password) {
  const res = await api('/auth/login', {
    method: 'POST',
    body: { telefono, password },
  });
  if (!res?.token) throw new Error('Login sin token');
  return res.token;
}

async function main() {
  const telefono = process.env.ADMIN_TELEFONO;
  const password = process.env.ADMIN_PASSWORD;
  if (!telefono || !password) {
    throw new Error('Faltan ADMIN_TELEFONO y ADMIN_PASSWORD en el entorno');
  }

  console.log(`API: ${API_BASE}`);
  const token = await login(telefono, password);
  console.log('✓ Login OK');

  const misClubes = await api('/api/clubs/mios', { token });
  const clubs = misClubes?.data ?? misClubes ?? [];
  const club = (Array.isArray(clubs) ? clubs : []).find((c) =>
    String(c.nombre || '').toLowerCase().includes(CLUB_QUERY),
  );
  if (!club) {
    console.log('Clubs disponibles:', (Array.isArray(clubs) ? clubs : []).map((c) => c.nombre));
    throw new Error(`Club "${CLUB_QUERY}" no encontrado en tus clubes`);
  }

  console.log(`Club: ${club.nombre} (id=${club.id})`);

  const perfil = await api(`/api/clubs/${club.id}/perfil`, { token });
  const divisiones = perfil?.data?.divisiones ?? perfil?.divisiones ?? [];
  if (!divisiones.length) throw new Error('El club no tiene divisiones');

  const division = divisiones[0];
  console.log(`División: ${division.nombre} (id=${division.id})`);

  const jugadoresRes = await api(
    `/api/clubs/${club.id}/divisiones/${division.id}/jugadores`,
    { token },
  );
  const actuales = jugadoresRes?.data ?? jugadoresRes ?? [];
  const idsActuales = new Set((Array.isArray(actuales) ? actuales : []).map((j) => j.usuario_id ?? j.id));

  const buscarRes = await api('/api/usuarios/buscar?q=SEED_jugador', { token });
  const candidatos = (buscarRes?.data ?? buscarRes ?? [])
    .filter((u) => u.id && !idsActuales.has(u.id));

  if (candidatos.length < JUGADORES) {
    throw new Error(`Solo ${candidatos.length} candidatos disponibles (se necesitan ${JUGADORES})`);
  }

  const picked = candidatos.slice(0, JUGADORES);
  const inserted = [];

  for (let i = 0; i < picked.length; i += 1) {
    const user = picked[i];
    const dorsal = i + 1;
    const posicion = POSICIONES[i % POSICIONES.length];

    await api(`/api/clubs/${club.id}/divisiones/${division.id}/atletas`, {
      method: 'POST',
      token,
      body: {
        usuario_id: user.id,
        dorsal,
        posicion,
        estado: 'ACTIVO',
      },
    });

    inserted.push({
      id: user.id,
      nick: user.nick,
      name: user.name,
      dorsal,
      posicion,
    });
    console.log(`  + ${user.nick || user.name} (id=${user.id}) dorsal ${dorsal}`);
  }

  console.log(`\n✅ ${inserted.length} jugadores agregados a ${club.nombre} → ${division.nombre}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
