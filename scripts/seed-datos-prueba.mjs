/**
 * Seed de datos de prueba para UI/rendimiento local.
 * NUNCA ejecutar en producción.
 *
 * Uso:
 *   node scripts/run-migration-015-es-dato-prueba.mjs   (solo la primera vez)
 *   node scripts/seed-datos-prueba.mjs
 *
 * Limpieza:
 *   node scripts/limpiar-datos-prueba.mjs
 *
 * Partidos (después del seed de usuarios):
 *   node scripts/run-migration-017-es-dato-prueba-partidos.mjs
 *   node scripts/seed-partidos-prueba.mjs
 *
 * Credenciales de todos los usuarios seed: nick SEED_jugador_XX / password SeedZyra2026!
 */
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';
import {
  User,
  Sports,
  UsuarioStatsPorSport,
  Team,
  TeamMiembros,
  DataTeam,
  Publicaciones,
  PublicacionDeportes,
  PublicacionEtiquetas,
  Seguidores,
} from '../src/db/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PASSWORD = 'SeedZyra2026!';
const TOTAL_USUARIOS = 40;
const USUARIOS_CON_SOCIAL = 30;

const NOMBRES = [
  'Valentina Mora', 'Lucas Pineda', 'Camilo Restrepo', 'Mariana Duarte',
  'Sofía Quintero', 'Mateo Giraldo', 'Laura Henao', 'Nicolás Sepúlveda',
  'Paula Rincón', 'Diego Salazar', 'Catalina Mejía', 'Felipe Ospina',
  'Isabella Torres', 'Sebastián Muñoz', 'Daniela Castaño', 'Tomás Arias',
  'Gabriela Franco', 'Juan Pablo López', 'Ana Lucía Vargas', 'Ricardo Montoya',
  'Juliana Pardo', 'Óscar Beltrán', 'Natalia Cárdenas', 'Esteban Hoyos',
  'Verónica Palacio', 'Mauricio Gallego', 'Lorena Escobar', 'Iván Murillo',
  'Carolina Betancur', 'Hernán Zapata', 'Liliana Correa', 'Gustavo Peña',
  'Adriana Solano', 'Rodrigo Maldonado', 'Patricia Nieto', 'Edwin Forero',
  'Claudia Ríos', 'Jaime Perdomo', 'Mónica Delgado', 'Felipe Ardila',
];

const EQUIPOS_FUTBOL = [
  'SEED_FC Cordillera',
  'SEED_Atlético Horizonte',
  'SEED_Unión Parque',
  'SEED_Real Brisa',
  'SEED_Deportivo Cumbre',
];

const EQUIPOS_VOLEY = [
  'SEED_Voleibol Andes',
  'SEED_Vóley Altura',
  'SEED_Smash Norte',
  'SEED_Red Volcán',
];

const POS_FUTBOL = ['PORTERO', 'DEFENSA', 'MEDIOCAMPISTA', 'DELANTERO'];
const POS_VOLEY = ['ARMADOR', 'CENTRAL', 'PUNTA', 'OPUESTO', 'LÍBERO'];
const PIERNAS = ['DERECHA', 'IZQUIERDA', 'AMBIDIESTRO'];

const CAPTIONS_FUTBOL = [
  'Entrenamiento de hoy ⚽',
  'Gol en el partido de ayer',
  'Preparados para el torneo',
  'Táctica y mucho trabajo',
  null,
];

const CAPTIONS_VOLEY = [
  'Bloqueo perfecto 🏐',
  'Set ganado en casa',
  'Entrenamiento de remate',
  'Equipo unido',
  null,
];

const VIDEO_SAMPLE =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randomInt(0, arr.length - 1)];
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const aplicarMigracion = async () => {
  const migrationPath = path.join(__dirname, '../src/db/migrations/015_es_dato_prueba.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
};

const resolverDeportes = async () => {
  const deportes = await Sports.findAll({ attributes: ['id', 'name'] });
  const futbol = deportes.find((d) => /f[uú]tbol/i.test(d.name));
  const voley = deportes.find((d) => /v[oó]ley|volleyball/i.test(d.name));

  if (!futbol || !voley) {
    throw new Error('No se encontraron deportes Fútbol y Vóley en la tabla sports.');
  }

  return { futbol, voley };
};

const verificarSeedExistente = async () => {
  const [rows] = await sequelize.query(`
    SELECT COUNT(*)::int AS total
    FROM "user"
    WHERE es_dato_prueba = true OR nick LIKE 'SEED_%'
  `);
  return rows[0]?.total > 0;
};

const generarStats = () => ({
  elo_oficial: Number((randomInt(85, 240) / 10).toFixed(1)),
  goles_oficiales: 0,
  partidos_oficiales: 0,
  elo_casual: Number((randomInt(80, 220) / 10).toFixed(1)),
  goles_casuales: 0,
  partidos_casuales: 0,
  dorsal_preferido: randomInt(1, 99),
  pierna_habil: pick(PIERNAS),
});

const crearUsuarios = async (futbolId, voleyId, passwordHash, transaction) => {
  const tx = { transaction };
  const usuarios = [];

  for (let i = 0; i < TOTAL_USUARIOS; i += 1) {
    const num = String(i + 1).padStart(2, '0');
    const esFutbol = i < 20;
    const sportId = esFutbol ? futbolId : voleyId;
    const posiciones = esFutbol ? POS_FUTBOL : POS_VOLEY;
    const stats = generarStats();

    const user = await User.create({
      name: NOMBRES[i],
      nick: `SEED_jugador_${num}`,
      email: `SEED_jugador_${num}@zyra-test.local`,
      telefono: `300${num.padStart(7, '0')}`,
      password_hash: passwordHash,
      role: 'JUGADOR',
      status: 'ACTIVO',
      bio: esFutbol
        ? 'Jugador de fútbol. Datos de prueba locales.'
        : 'Jugadora/o de vóley. Datos de prueba locales.',
      deporte_principal_id: sportId,
      es_dato_prueba: true,
      creado_at: new Date(Date.now() - randomInt(1, 180) * 86400000),
    }, tx);

    await UsuarioStatsPorSport.create({
      user_id: user.id,
      sport_id: sportId,
      elo_oficial: stats.elo_oficial,
      goles_oficiales: stats.goles_oficiales,
      partidos_oficiales: stats.partidos_oficiales,
      elo_casual: stats.elo_casual,
      goles_casuales: stats.goles_casuales,
      partidos_casuales: stats.partidos_casuales,
      posicion_principal: pick(posiciones),
      pierna_habil: esFutbol ? stats.pierna_habil : null,
      mano_habil: esFutbol ? null : pick(PIERNAS),
      dorsal_preferido: stats.dorsal_preferido,
    }, tx);

    usuarios.push({
      ...user.toJSON(),
      sportId,
      esFutbol,
    });
  }

  return usuarios;
};

const crearEquipos = async (futbolId, voleyId, usuarios, transaction) => {
  const tx = { transaction };
  const equipos = [];
  const usuariosFutbol = usuarios.filter((u) => u.esFutbol);
  const usuariosVoley = usuarios.filter((u) => !u.esFutbol);

  const crearEquipoConMiembros = async (nombre, sportId, miembros, posiciones) => {
    const capitan = miembros[0];
    const equipo = await Team.create({
      name: nombre,
      sport_id: sportId,
      capitan_id: capitan.id,
      privado: false,
      es_dato_prueba: true,
      creado_at: new Date(),
    }, tx);

    await DataTeam.create({
      team_id: equipo.id,
      elo: randomInt(10, 280),
      games: randomInt(5, 60),
      win: randomInt(2, 30),
      lose: randomInt(1, 25),
      draw: randomInt(0, 10),
      total: randomInt(10, 80),
    }, tx);

    for (let i = 0; i < miembros.length; i += 1) {
      const miembro = miembros[i];
      let rol = 'JUGADOR';
      if (i === 0) rol = 'CAPITAN';
      else if (i === 1 && miembros.length > 3) rol = 'SUB_CAPITAN';

      await TeamMiembros.create({
        team_id: equipo.id,
        user_id: miembro.id,
        position: posiciones[i % posiciones.length],
        rol,
        estado_invitacion: 'ACEPTADO',
        dorsal_habitual: i + 1,
        fecha_union: new Date(Date.now() - randomInt(5, 120) * 86400000),
      }, tx);
    }

    equipos.push(equipo);
    return equipo;
  };

  const chunksFutbol = [];
  const chunkSizeFutbol = Math.ceil(usuariosFutbol.length / EQUIPOS_FUTBOL.length);
  for (let i = 0; i < EQUIPOS_FUTBOL.length; i += 1) {
    chunksFutbol.push(usuariosFutbol.slice(i * chunkSizeFutbol, (i + 1) * chunkSizeFutbol));
  }

  for (let i = 0; i < EQUIPOS_FUTBOL.length; i += 1) {
    await crearEquipoConMiembros(
      EQUIPOS_FUTBOL[i],
      futbolId,
      chunksFutbol[i],
      POS_FUTBOL
    );
  }

  const chunksVoley = [];
  const chunkSizeVoley = Math.ceil(usuariosVoley.length / EQUIPOS_VOLEY.length);
  for (let i = 0; i < EQUIPOS_VOLEY.length; i += 1) {
    chunksVoley.push(usuariosVoley.slice(i * chunkSizeVoley, (i + 1) * chunkSizeVoley));
  }

  for (let i = 0; i < EQUIPOS_VOLEY.length; i += 1) {
    await crearEquipoConMiembros(
      EQUIPOS_VOLEY[i],
      voleyId,
      chunksVoley[i],
      POS_VOLEY
    );
  }

  return equipos;
};

const crearPublicaciones = async (usuarios, transaction) => {
  const tx = { transaction };
  const publicaciones = [];

  for (const usuario of usuarios) {
    const cantidad = randomInt(1, 3);
    const captions = usuario.esFutbol ? CAPTIONS_FUTBOL : CAPTIONS_VOLEY;
    const deporteTag = pick(['sport', 'sport', 'general']);

    for (let p = 0; p < cantidad; p += 1) {
      const esVideo = p === cantidad - 1 && Math.random() < 0.25;
      const tipo = esVideo ? 'VIDEO' : 'FOTO';
      const seedKey = `${usuario.nick}-${p}`;
      const url = esVideo
        ? VIDEO_SAMPLE
        : `https://picsum.photos/seed/${encodeURIComponent(seedKey)}/900/1200`;

      const pub = await Publicaciones.create({
        user_id: usuario.id,
        tipo,
        url_media: url,
        caption: pick(captions),
        media_width: esVideo ? 1280 : 900,
        media_height: esVideo ? 720 : 1200,
        es_dato_prueba: true,
        creado_at: new Date(Date.now() - randomInt(1, 90) * 86400000),
      }, tx);

      if (deporteTag === 'sport' || (deporteTag === 'general' && Math.random() < 0.5)) {
        await PublicacionDeportes.create({
          publicacion_id: pub.id,
          sport_id: usuario.sportId,
        }, tx);
      }

      publicaciones.push({ ...pub.toJSON(), autorId: usuario.id });
    }
  }

  return publicaciones;
};

const crearEtiquetas = async (publicaciones, usuarios, transaction) => {
  const tx = { transaction };
  let total = 0;
  const userIds = usuarios.map((u) => u.id);

  for (const pub of publicaciones) {
    if (Math.random() > 0.35) continue;

    const candidatos = userIds.filter((id) => id !== pub.autorId);
    const etiquetadoId = pick(candidatos);
    const confirmado = Math.random() < 0.55;

    await PublicacionEtiquetas.create({
      publicacion_id: pub.id,
      user_id_etiquetado: etiquetadoId,
      confirmado,
    }, tx);
    total += 1;
  }

  return total;
};

const crearSeguidores = async (usuarios, transaction) => {
  const tx = { transaction };
  const activos = usuarios.slice(0, USUARIOS_CON_SOCIAL);
  const pares = new Set();
  let total = 0;

  for (const seguidor of activos) {
    const objetivoCount = randomInt(3, 8);
    const objetivos = shuffle(activos.filter((u) => u.id !== seguidor.id)).slice(0, objetivoCount);

    for (const seguido of objetivos) {
      const key = `${seguidor.id}->${seguido.id}`;
      if (pares.has(key)) continue;
      pares.add(key);

      await Seguidores.create({
        seguidor_user_id: seguidor.id,
        seguido_user_id: seguido.id,
        es_dato_prueba: true,
      }, tx);
      total += 1;
    }
  }

  for (let i = 0; i < 15; i += 1) {
    const a = pick(activos);
    const b = pick(activos.filter((u) => u.id !== a.id));
    const key = `${b.id}->${a.id}`;
    if (pares.has(key)) continue;
    pares.add(key);

    await Seguidores.create({
      seguidor_user_id: b.id,
      seguido_user_id: a.id,
      es_dato_prueba: true,
    }, tx);
    total += 1;
  }

  return total;
};

try {
  console.log('=== Seed datos de prueba Zyra (SOLO LOCAL) ===\n');

  await aplicarMigracion();

  if (await verificarSeedExistente()) {
    console.error(
      'Ya existen usuarios seed. Ejecuta primero: node scripts/limpiar-datos-prueba.mjs'
    );
    process.exit(1);
  }

  const { futbol, voley } = await resolverDeportes();
  console.log(`Deportes: Fútbol id=${futbol.id}, Vóley id=${voley.id}`);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  let resumen = {};

  await sequelize.transaction(async (transaction) => {
    const usuarios = await crearUsuarios(futbol.id, voley.id, passwordHash, transaction);
    const equipos = await crearEquipos(futbol.id, voley.id, usuarios, transaction);
    const publicaciones = await crearPublicaciones(usuarios, transaction);
    const etiquetas = await crearEtiquetas(publicaciones, usuarios, transaction);
    const seguidores = await crearSeguidores(usuarios, transaction);

    resumen = {
      usuarios: usuarios.length,
      equipos: equipos.length,
      publicaciones: publicaciones.length,
      etiquetas,
      seguidores,
      aislados: TOTAL_USUARIOS - USUARIOS_CON_SOCIAL,
    };
  });

  console.log('\n✅ Seed completado:\n');
  console.log(JSON.stringify(resumen, null, 2));
  console.log('\nMarcadores: es_dato_prueba=true, nick SEED_jugador_XX, equipos SEED_*');
  console.log(`Login de prueba: teléfono 30000000001 / ${SEED_PASSWORD} (SEED_jugador_01)`);
  console.log('\nSiguiente paso (partidos coherentes):');
  console.log('  node scripts/run-migration-017-es-dato-prueba-partidos.mjs');
  console.log('  node scripts/seed-partidos-prueba.mjs');
  console.log('\nLimpieza antes de producción: node scripts/limpiar-datos-prueba.mjs');
} catch (error) {
  console.error('\nError en seed:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
