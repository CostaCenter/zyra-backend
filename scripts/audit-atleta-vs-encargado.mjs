/**
 * Audita inconsistencias: atleta en nómina vs encargado_id vs rol_membresia.
 * Uso: node scripts/audit-atleta-vs-encargado.mjs [clubId|nombre]
 */
import '../src/config/loadEnv.js';
import sequelize from '../src/config/database.js';

const arg = process.argv[2] ?? 'Zyra Club';

try {
  const host = process.env.DB_HOST || (process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).hostname
    : '?');
  const dbName = process.env.DB_NAME || '(from DATABASE_URL)';
  console.log(`DB: ${host} / ${dbName}\n`);

  let club;
  if (/^\d+$/.test(arg)) {
    const [rows] = await sequelize.query(
      `SELECT id, nombre, admin_id FROM clubs WHERE id = :id`,
      { replacements: { id: Number(arg) } },
    );
    club = rows[0];
  } else {
    const [rows] = await sequelize.query(
      `SELECT id, nombre, admin_id FROM clubs WHERE nombre ILIKE :q ORDER BY id`,
      { replacements: { q: `%${arg}%` } },
    );
    club = rows[0];
    if (rows.length > 1) {
      console.log('Clubs que coinciden:', rows);
      console.log(`Usando el primero: ${club.nombre} (id=${club.id})\n`);
    }
  }

  if (!club) {
    console.log('Club no encontrado:', arg);
    process.exit(1);
  }

  const [admin] = await sequelize.query(
    `SELECT id, nick, name FROM "user" WHERE id = :id`,
    { replacements: { id: club.admin_id } },
  );

  console.log('=== CLUB ===');
  console.log({
    id: club.id,
    nombre: club.nombre,
    admin_id: club.admin_id,
    admin: admin[0] ?? null,
  });

  const [divs] = await sequelize.query(
    `SELECT d.id, d.nombre, d.genero, d.encargado_id,
            u.nick AS encargado_nick, u.name AS encargado_name
     FROM club_divisiones d
     LEFT JOIN "user" u ON u.id = d.encargado_id
     WHERE d.club_id = :clubId
     ORDER BY d.id`,
    { replacements: { clubId: club.id } },
  );
  console.log('\n=== DIVISIONES (encargado_id) ===');
  console.table(divs.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    encargado_id: d.encargado_id,
    encargado: d.encargado_nick || d.encargado_name || '(sin encargado)',
  })));

  const [miembros] = await sequelize.query(
    `SELECT m.usuario_id, m.rol_membresia, m.estado, u.nick, u.name
     FROM club_miembros m
     JOIN "user" u ON u.id = m.usuario_id
     WHERE m.club_id = :clubId
     ORDER BY m.rol_membresia, u.nick`,
    { replacements: { clubId: club.id } },
  );
  console.log('\n=== CLUB_MIEMBROS (rol_membresia) ===');
  console.table(miembros.map((m) => ({
    usuario_id: m.usuario_id,
    nick: m.nick,
    rol: m.rol_membresia,
    estado: m.estado,
  })));

  const [atletas] = await sequelize.query(
    `SELECT cda.usuario_id, cda.club_division_id, cda.estado, cda.posicion,
            d.nombre AS division, d.encargado_id,
            u.nick, u.name,
            m.rol_membresia
     FROM club_division_atletas cda
     JOIN club_divisiones d ON d.id = cda.club_division_id
     JOIN "user" u ON u.id = cda.usuario_id
     LEFT JOIN club_miembros m
       ON m.club_id = d.club_id AND m.usuario_id = cda.usuario_id
     WHERE d.club_id = :clubId
     ORDER BY d.id, u.nick`,
    { replacements: { clubId: club.id } },
  );

  console.log(`\n=== NÓMINA (atletas) — ${atletas.length} filas ===`);

  // Casos sospechosos: atleta que TAMBIÉN es encargado_id de alguna división del club
  const encargadoIds = new Set(divs.map((d) => d.encargado_id).filter(Boolean));
  const atletasQueSonEncargado = atletas.filter((a) => encargadoIds.has(a.usuario_id));

  console.log('\n--- SOSPECHOSOS: en nómina Y son encargado_id ---');
  if (!atletasQueSonEncargado.length) {
    console.log('(ninguno)');
  } else {
    console.table(atletasQueSonEncargado.map((a) => ({
      usuario_id: a.usuario_id,
      nick: a.nick,
      division_atleta: a.division,
      rol_membresia: a.rol_membresia ?? '(sin membresía)',
      es_encargado_de: divs
        .filter((d) => d.encargado_id === a.usuario_id)
        .map((d) => d.nombre)
        .join(', '),
      puede_crear_entrenamiento_BE: 'SÍ (por encargado_id, no por rol atleta)',
    })));
  }

  // rol ENCARGADO/ENTRENADOR en club_miembros pero SIN ser encargado_id
  const staffSinDivision = miembros.filter((m) =>
    ['ENCARGADO', 'ENTRENADOR', 'STAFF'].includes(m.rol_membresia)
    && !encargadoIds.has(m.usuario_id)
    && m.usuario_id !== club.admin_id
  );
  console.log('\n--- staff por rol_membresia SIN encargado_id (NO pueden crear entrenamiento) ---');
  if (!staffSinDivision.length) {
    console.log('(ninguno)');
  } else {
    console.table(staffSinDivision.map((m) => ({
      usuario_id: m.usuario_id,
      nick: m.nick,
      rol_membresia: m.rol_membresia,
      puede_crear_entrenamiento_BE: 'NO',
    })));
  }

  // Simular puedeGestionarDivision para un atleta "puro" de ejemplo
  const atletaPuro = atletas.find((a) =>
    a.usuario_id !== club.admin_id
    && !encargadoIds.has(a.usuario_id)
    && (!a.rol_membresia || a.rol_membresia === 'MIEMBRO' || a.rol_membresia === 'ATLETA')
  );

  console.log('\n=== SIMULACIÓN BE (atleta puro de ejemplo) ===');
  if (!atletaPuro) {
    console.log('No hay atleta puro (todos los de nómina son admin/encargado).');
  } else {
    const [check] = await sequelize.query(
      `SELECT id, nombre FROM club_divisiones
       WHERE club_id = :clubId AND id = :divId AND encargado_id = :uid`,
      {
        replacements: {
          clubId: club.id,
          divId: atletaPuro.club_division_id,
          uid: atletaPuro.usuario_id,
        },
      },
    );
    console.log({
      usuario_id: atletaPuro.usuario_id,
      nick: atletaPuro.nick,
      division: atletaPuro.division,
      rol_membresia: atletaPuro.rol_membresia ?? '(sin)',
      match_encargado_id: check.length > 0,
      resultado_esperado_POST_evento: check.length ? '201' : '403',
    });
  }

  // Eventos creados por usuarios que solo son atletas (si hay histórico del bug)
  const [eventosSospechosos] = await sequelize.query(
    `SELECT e.id, e.titulo, e.fecha_hora, e.creado_por_id, u.nick,
            d.nombre AS division, d.encargado_id,
            m.rol_membresia,
            CASE
              WHEN e.creado_por_id = :adminId THEN 'admin'
              WHEN e.creado_por_id = d.encargado_id THEN 'encargado_division'
              ELSE 'NO_ES_ADMIN_NI_ENCARGADO'
            END AS autoridad_al_crear
     FROM club_eventos e
     JOIN club_divisiones d ON d.id = e.club_division_id
     JOIN "user" u ON u.id = e.creado_por_id
     LEFT JOIN club_miembros m
       ON m.club_id = d.club_id AND m.usuario_id = e.creado_por_id
     WHERE d.club_id = :clubId AND e.tipo = 'ENTRENAMIENTO'
     ORDER BY e.id DESC
     LIMIT 30`,
    { replacements: { clubId: club.id, adminId: club.admin_id } },
  );

  console.log('\n=== ÚLTIMOS ENTRENAMIENTOS (quién los creó) ===');
  console.table(eventosSospechosos.map((e) => ({
    id: e.id,
    titulo: e.titulo?.slice(0, 40),
    creado_por: e.nick,
    rol_membresia: e.rol_membresia ?? '(sin)',
    autoridad: e.autoridad_al_crear,
  })));

  const ilegales = eventosSospechosos.filter((e) => e.autoridad_al_crear === 'NO_ES_ADMIN_NI_ENCARGADO');
  console.log(`\nEntrenamientos creados sin ser admin/encargado_id: ${ilegales.length}`);
  if (ilegales.length) {
    console.table(ilegales.map((e) => ({
      id: e.id,
      creado_por_id: e.creado_por_id,
      nick: e.nick,
      division: e.division,
      encargado_id_division: e.encargado_id,
      rol_membresia: e.rol_membresia,
    })));
  }
} finally {
  await sequelize.close();
}
