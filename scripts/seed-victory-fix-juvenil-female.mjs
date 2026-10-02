/**
 * Corrige JUVENIL (FEMENINO): reemplaza atletas no femeninos y crea usuarias si faltan.
 */
import bcrypt from 'bcryptjs';
import '../scripts/load-env-for-scripts.mjs';
import sequelize from '../src/config/database.js';
import { User, Sports } from '../src/db/db.js';

const CLUB_ID = 4;
const JUVENIL_DIVISION_ID = 16;
const SEED_PASSWORD = 'SeedZyra2026!';

const FEMALE_HINTS = /valentina|mariana|sofía|sofia|laura|paula|catalina|isabella|daniela|gabriela|ana |juliana|natalia|verónica|veronica|lorena|carolina|liliana|adriana|patricia|claudia|mónica|monica|carmen|elena|maría|maria|diana|helena|tatiana|olga|elizabeth|sánchez|ulloa|cifuentes|duque|vélez|santamaría|molina/i;

const NUEVAS_FEMENINAS = [
  'Sara Montenegro',
  'Camila Restrepo',
  'Andrea Giraldo',
  'Lucía Mejía',
  'Manuela Ortiz',
  'Valeria Soto',
  'Emilia Castro',
  'Antonella Ruiz',
];

function esNombreFemenino(name, nick) {
  return FEMALE_HINTS.test(`${name || ''} ${nick || ''}`);
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const voley = await Sports.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      'LIKE',
      '%vole%',
    ),
  });
  const sportId = voley?.id ?? 2;

  const [assignedRows] = await sequelize.query(
    `SELECT cda.usuario_id FROM club_division_atletas cda
     JOIN club_divisiones cd ON cd.id = cda.club_division_id
     WHERE cd.club_id = :clubId`,
    { replacements: { clubId: CLUB_ID } },
  );
  const assigned = new Set(assignedRows.map((r) => r.usuario_id));

  const [juvenilRows] = await sequelize.query(
    `SELECT cda.id, cda.usuario_id, cda.dorsal, u.name, u.nick
     FROM club_division_atletas cda
     JOIN "user" u ON u.id = cda.usuario_id
     WHERE cda.club_division_id = :divId
     ORDER BY cda.dorsal`,
    { replacements: { divId: JUVENIL_DIVISION_ID } },
  );

  const aReemplazar = juvenilRows.filter((r) => !esNombreFemenino(r.name, r.nick));
  console.log(`JUVENIL: ${aReemplazar.length} atletas a reemplazar`);

  let [pool] = await sequelize.query(`SELECT id, nick, name FROM "user" ORDER BY id`);
  pool = pool.filter((u) => esNombreFemenino(u.name, u.nick) && !assigned.has(u.id));

  const faltantes = aReemplazar.length - pool.length;
  const creadas = [];

  if (faltantes > 0) {
    await sequelize.transaction(async (transaction) => {
      for (let i = 0; i < faltantes && i < NUEVAS_FEMENINAS.length; i += 1) {
        const num = String(i + 1).padStart(2, '0');
        const name = NUEVAS_FEMENINAS[i];
        const nick = `SEED_victory_fem_${num}`;
        const existing = await User.findOne({ where: { nick }, transaction });
        if (existing) {
          pool.push({ id: existing.id, nick: existing.nick, name: existing.name });
          continue;
        }
        const phoneSuffix = String(Date.now() % 10000000 + i).padStart(7, '0');
        const user = await User.create({
          name,
          nick,
          email: `${nick}@zyra-test.local`,
          telefono: `319${phoneSuffix}`,
          password_hash: passwordHash,
          role: 'JUGADOR',
          status: 'ACTIVO',
          bio: 'Jugadora Victory CLUB — dato de prueba',
          deporte_principal_id: sportId,
          es_dato_prueba: true,
        }, { transaction });
        pool.push({ id: user.id, nick: user.nick, name: user.name });
        creadas.push(user.name);
      }
    });
    console.log('Usuarias creadas:', creadas);
  }

  if (pool.length < aReemplazar.length) {
    throw new Error(`Pool insuficiente: ${pool.length}/${aReemplazar.length}`);
  }

  await sequelize.transaction(async (transaction) => {
    for (let i = 0; i < aReemplazar.length; i += 1) {
      const old = aReemplazar[i];
      const nueva = pool[i];

      await sequelize.query(`DELETE FROM club_division_atletas WHERE id = :id`, {
        replacements: { id: old.id },
        transaction,
      });

      const datos = JSON.stringify({
        tipo_documento: 'CC',
        numero_documento: String(1002000000 + nueva.id),
        telefono: `300${String(nueva.id).padStart(7, '0')}`,
        email: '',
        fecha_nacimiento: `${new Date().getFullYear() - 17}-03-${String(10 + i).padStart(2, '0')}`,
        tipo_sangre: 'O+',
        contacto_emergencia_nombre: 'Contacto emergencia',
        contacto_emergencia_telefono: `310${String(nueva.id).padStart(7, '0')}`,
        contacto_emergencia_parentesco: 'Madre',
        direccion: 'Medellín, Antioquia',
        observaciones: 'Atleta FEMENINO — JUVENIL (17 a 18 años)',
      });

      await sequelize.query(
        `INSERT INTO club_division_atletas
           (club_division_id, usuario_id, dorsal, posicion, estado, fecha_ingreso, datos_personales)
         VALUES (:divId, :userId, :dorsal, 'PUNTA', 'ACTIVO', NOW(), :datos::jsonb)`,
        {
          replacements: {
            divId: JUVENIL_DIVISION_ID,
            userId: nueva.id,
            dorsal: old.dorsal,
            datos,
          },
          transaction,
        },
      );

      await sequelize.query(
        `INSERT INTO club_miembros (club_id, usuario_id, rol_membresia, estado, fecha_ingreso)
         VALUES (:clubId, :userId, 'MIEMBRO', 'ACTIVO', NOW())
         ON CONFLICT (club_id, usuario_id) DO NOTHING`,
        { replacements: { clubId: CLUB_ID, userId: nueva.id }, transaction },
      );

      console.log(`  ${old.name || old.nick} → ${nueva.name || nueva.nick}`);
    }
  });

  console.log('✅ JUVENIL corregida');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => sequelize.close());
