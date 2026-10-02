/**
 * Victory CLUB: 12 atletas únicos por división (sin repetir entre divisiones).
 * Asigna dorsal, posición y datos_personales acordes al género/edad de cada división.
 *
 * Uso:
 *   node scripts/seed-victory-divisiones-atletas.mjs
 */
import '../scripts/load-env-for-scripts.mjs';
import sequelize from '../src/config/database.js';

const CLUB_QUERY = '%victory%';
const ATLETAS_POR_DIVISION = 12;

const POSICIONES = [
  'ARMADOR', 'PUNTA', 'CENTRAL', 'OPUESTO', 'PUNTA',
  'CENTRAL', 'LÍBERO', 'PUNTA', 'ARMADOR', 'CENTRAL',
  'OPUESTO', 'PUNTA',
];

/** Nombres femeninos explícitos para divisiones FEMENINO */
const FEMALE_USER_IDS_PREFERRED = [
  135, 138, 139, 141, 143, 145, 147, 149, 151, 153, 155, 157,
  159, 161, 163, 165, 167, 169, 171, 173, 261, 265, 277, 298,
  340, 13, 10, 2,
];

/** Nombres masculinos para Plantel Principal (mixto) */
const MALE_USER_IDS_PREFERRED = [
  136, 137, 140, 142, 144, 146, 148, 150, 152, 154, 156, 158,
  160, 162, 164, 166, 168, 170, 172, 174, 1, 8, 11,
];

function edadParaDivision(division) {
  const cat = String(division.categoria_edad || '').toLowerCase();
  if (cat.includes('12') && cat.includes('14')) return { min: 12, max: 14 };
  if (cat.includes('17') && cat.includes('18')) return { min: 17, max: 18 };
  if (/menor/i.test(division.nombre)) return { min: 14, max: 16 };
  if (/juvenil/i.test(division.nombre)) return { min: 17, max: 18 };
  if (/infantil/i.test(division.nombre)) return { min: 12, max: 14 };
  return { min: 18, max: 28 };
}

function fechaNacimientoDesdeEdad(edad) {
  const year = new Date().getFullYear() - edad;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function datosPersonalesAtleta({ division, index, usuarioId }) {
  const { min, max } = edadParaDivision(division);
  const edad = min + (index % (max - min + 1));
  const generoDiv = (division.genero || 'MIXTO').toUpperCase();

  return {
    tipo_documento: 'CC',
    numero_documento: String(1000000000 + usuarioId * 10 + index),
    telefono: `300${String(usuarioId).padStart(7, '0')}`,
    email: '',
    fecha_nacimiento: fechaNacimientoDesdeEdad(edad),
    tipo_sangre: ['O+', 'A+', 'B+', 'AB+', 'O-'][index % 5],
    contacto_emergencia_nombre: 'Contacto emergencia',
    contacto_emergencia_telefono: `310${String(usuarioId).padStart(7, '0')}`,
    contacto_emergencia_parentesco: index % 2 === 0 ? 'Madre' : 'Padre',
    direccion: 'Medellín, Antioquia',
    observaciones: `Atleta ${generoDiv} — ${division.nombre}`,
  };
}

async function query(sql, replacements = {}) {
  const [rows] = await sequelize.query(sql, { replacements });
  return rows;
}

async function main() {
  const clubs = await query(
    `SELECT id, nombre, admin_id FROM clubs WHERE nombre ILIKE :q ORDER BY id`,
    { q: CLUB_QUERY },
  );
  const club = clubs[0];
  if (!club) throw new Error('Victory CLUB no encontrado');

  const divisions = await query(
    `SELECT id, nombre, genero, categoria_edad
     FROM club_divisiones WHERE club_id = :clubId ORDER BY id`,
    { clubId: club.id },
  );
  if (!divisions.length) throw new Error('Sin divisiones');

  console.log(`Club: ${club.nombre} (id=${club.id})`);
  console.log('Divisiones:', divisions.map((d) => `${d.nombre} [${d.genero ?? 'MIXTO'}]`).join(', '));

  const assignedGlobal = new Set(
    (await query(
      `SELECT cda.usuario_id FROM club_division_atletas cda
       JOIN club_divisiones cd ON cd.id = cda.club_division_id
       WHERE cd.club_id = :clubId`,
      { clubId: club.id },
    )).map((r) => r.usuario_id),
  );
  assignedGlobal.add(club.admin_id);

  const allUsers = await query(`SELECT id, nick, name FROM "user" ORDER BY id`);
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  const pickFromPool = (preferredIds, count) => {
    const picked = [];
    for (const id of preferredIds) {
      if (picked.length >= count) break;
      if (assignedGlobal.has(id) || !userById.has(id)) continue;
      picked.push(userById.get(id));
      assignedGlobal.add(id);
    }
    if (picked.length < count) {
      for (const u of allUsers) {
        if (picked.length >= count) break;
        if (assignedGlobal.has(u.id)) continue;
        picked.push(u);
        assignedGlobal.add(u.id);
      }
    }
    if (picked.length < count) {
      throw new Error(`Solo se pudieron asignar ${picked.length}/${count} usuarios únicos`);
    }
    return picked;
  };

  const resumen = [];

  const divisionesOrdenadas = [...divisions].sort((a, b) => {
    const rank = (d) => {
      if (d.genero === 'FEMENINO' || d.genero === 'MASCULINO') return 0;
      return 1;
    };
    return rank(a) - rank(b) || a.id - b.id;
  });

  await sequelize.transaction(async (transaction) => {
    for (const division of divisionesOrdenadas) {
      const existing = await query(
        `SELECT COUNT(*)::int AS total FROM club_division_atletas WHERE club_division_id = :divId`,
        { divId: division.id },
      );
      const actuales = existing[0]?.total ?? 0;
      const needed = Math.max(0, ATLETAS_POR_DIVISION - actuales);
      if (needed === 0) {
        console.log(`\n⏭ ${division.nombre}: ya tiene ${actuales} atletas`);
        resumen.push({ division: division.nombre, agregados: 0, total: actuales });
        continue;
      }

      const genero = (division.genero || '').toUpperCase();
      let poolIds;
      if (genero === 'FEMENINO') {
        poolIds = FEMALE_USER_IDS_PREFERRED;
      } else if (genero === 'MASCULINO') {
        poolIds = MALE_USER_IDS_PREFERRED;
      } else {
        // Plantel Principal u otra sin género → mixto 6F + 6M si hay cupo parcial
        const half = Math.ceil(needed / 2);
        const females = pickFromPool(FEMALE_USER_IDS_PREFERRED, Math.min(half, needed));
        const males = pickFromPool(
          MALE_USER_IDS_PREFERRED,
          needed - females.length,
        );
        const picked = [...females, ...males];

        await insertAtletas({
          club,
          division,
          picked,
          startDorsal: actuales + 1,
          transaction,
        });

        resumen.push({ division: division.nombre, agregados: picked.length, total: actuales + picked.length });
        console.log(`\n✅ ${division.nombre} [MIXTO]: +${picked.length} atletas (${picked.length} total objetivo)`);
        picked.forEach((u, i) => console.log(`   #${actuales + i + 1} ${u.name || u.nick}`));
        continue;
      }

      const picked = pickFromPool(poolIds, needed);
      await insertAtletas({
        club,
        division,
        picked,
        startDorsal: actuales + 1,
        transaction,
      });

      resumen.push({ division: division.nombre, agregados: picked.length, total: actuales + picked.length });
      console.log(`\n✅ ${division.nombre} [${genero}]: +${picked.length} atletas`);
      picked.forEach((u, i) => console.log(`   #${actuales + i + 1} ${u.name || u.nick}`));
    }
  });

  console.log('\n--- Resumen ---');
  console.table(resumen);

  const dupes = await query(
    `SELECT cda.usuario_id, COUNT(*)::int AS veces
     FROM club_division_atletas cda
     JOIN club_divisiones cd ON cd.id = cda.club_division_id
     WHERE cd.club_id = :clubId
     GROUP BY cda.usuario_id
     HAVING COUNT(*) > 1`,
    { clubId: club.id },
  );
  if (dupes.length) {
    console.error('⚠️ Atletas repetidos entre divisiones:', dupes);
    process.exit(1);
  }
  console.log('✓ Ningún atleta repetido entre divisiones');
}

async function insertAtletas({ club, division, picked, startDorsal, transaction }) {
  for (let i = 0; i < picked.length; i += 1) {
    const user = picked[i];
    const dorsal = startDorsal + i;
    const posicion = POSICIONES[i % POSICIONES.length];
    const datos = JSON.stringify(datosPersonalesAtleta({
      division,
      index: i,
      usuarioId: user.id,
    }));

    await sequelize.query(
      `INSERT INTO club_division_atletas
         (club_division_id, usuario_id, dorsal, posicion, estado, fecha_ingreso, datos_personales)
       VALUES (:divisionId, :usuarioId, :dorsal, :posicion, 'ACTIVO', NOW(), :datos::jsonb)`,
      {
        replacements: {
          divisionId: division.id,
          usuarioId: user.id,
          dorsal,
          posicion,
          datos,
        },
        transaction,
      },
    );

    await sequelize.query(
      `INSERT INTO club_miembros (club_id, usuario_id, rol_membresia, estado, fecha_ingreso)
       VALUES (:clubId, :usuarioId, 'MIEMBRO', 'ACTIVO', NOW())
       ON CONFLICT (club_id, usuario_id) DO NOTHING`,
      { replacements: { clubId: club.id, usuarioId: user.id }, transaction },
    );
  }
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
