import sequelize from '../src/config/database.js';
import { User, Sports, UsuarioStatsPorSport } from '../src/db/db.js';
import {
  getMiPerfilDeportivo,
  updateMiPerfilDeportivo,
} from '../src/controllers/perfilDeportivoController.js';

const TEST_USER_ID = 1;

const crearMockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const invocarController = async (handler, req) => {
  const res = crearMockRes();
  await handler(req, res);
  return res;
};

const asegurarDeportes = async () => {
  const nombres = ['Futbol', 'Voley', 'Basquet'];
  const deportes = [];

  for (const name of nombres) {
    const [deporte] = await Sports.findOrCreate({
      where: { name },
      defaults: { state: 'Disponible' },
    });
    deportes.push(deporte);
  }

  return deportes;
};

const configurarUsuarioSoloFutbol = async (futbolId) => {
  await UsuarioStatsPorSport.destroy({ where: { user_id: TEST_USER_ID } });
  await UsuarioStatsPorSport.create({
    user_id: TEST_USER_ID,
    sport_id: futbolId,
    posicion_principal: 'DELANTERO',
    pierna_habil: 'DERECHA',
    dorsal_preferido: 10,
  });
};

try {
  console.log('=== test-agregar-deporte-flow ===\n');

  const usuario = await User.findByPk(TEST_USER_ID);
  if (!usuario) {
    throw new Error(`Usuario id=${TEST_USER_ID} no existe.`);
  }

  const deportes = await asegurarDeportes();
  const futbol = deportes.find((d) => d.name === 'Futbol');
  const voley = deportes.find((d) => d.name === 'Voley');
  const basquet = deportes.find((d) => d.name === 'Basquet');

  console.log('Deportes en BD:', deportes.map((d) => `${d.name}(id=${d.id})`).join(', '));
  console.log(`Usuario: id=${usuario.id}, name=${usuario.name ?? '(sin name)'}\n`);

  await configurarUsuarioSoloFutbol(futbol.id);
  console.log(`✓ Usuario configurado solo con Fútbol (sport_id=${futbol.id})\n`);

  console.log('--- GET mi-perfil-deportivo (sport_id=Futbol) ---');
  const getConFutbol = await invocarController(getMiPerfilDeportivo, {
    userId: TEST_USER_ID,
    query: { sport_id: String(futbol.id) },
  });
  console.log(`HTTP ${getConFutbol.statusCode}`);

  const listaDeportes = getConFutbol.body?.data?.deportes ?? [];
  const inactivos = listaDeportes.filter((d) => !d.activo);
  const activos = listaDeportes.filter((d) => d.activo);

  console.log('\nDeportes activos (círculos del selector):');
  console.table(activos.map((d) => ({ id: d.id, name: d.name, activo: d.activo })));

  console.log('\nDeportes inactivos (modal "Agregar"):');
  console.table(inactivos.map((d) => ({ id: d.id, name: d.name, activo: d.activo })));

  const nombresInactivos = inactivos.map((d) => d.name);
  const incluyeFutbolInactivo = nombresInactivos.some((n) => n.toLowerCase().includes('futbol'));
  const incluyeVoleyInactivo = nombresInactivos.some((n) => n.toLowerCase().includes('vole'));

  if (activos.some((d) => d.name === 'Futbol') && !incluyeFutbolInactivo) {
    console.log('\n✓ Fútbol está activo y NO aparece en el selector de agregar.');
  } else {
    console.error('\n✗ Fútbol debería estar activo y ausente del modal Agregar.');
    process.exitCode = 1;
  }

  if (incluyeVoleyInactivo) {
    console.log('✓ Vóley aparece en el selector de agregar.');
  } else {
    console.error('✗ Vóley debería aparecer en el selector de agregar.');
    process.exitCode = 1;
  }

  console.log('\n--- PUT agregar ficha de Vóley ---');
  const putVoley = await invocarController(updateMiPerfilDeportivo, {
    userId: TEST_USER_ID,
    body: {
      sport_id: voley.id,
      posicion_principal: 'ARMADOR',
      pierna_habil: 'DERECHA',
      dorsal_preferido: 7,
    },
  });
  console.log(`HTTP ${putVoley.statusCode}`);
  console.log(JSON.stringify(putVoley.body, null, 2));

  console.log('\n--- GET posterior (sport_id=Voley) ---');
  const getPosterior = await invocarController(getMiPerfilDeportivo, {
    userId: TEST_USER_ID,
    query: { sport_id: String(voley.id) },
  });
  console.log(`HTTP ${getPosterior.statusCode}`);

  const deportesPosterior = getPosterior.body?.data?.deportes ?? [];
  const voleyPosterior = deportesPosterior.find((d) => d.id === voley.id);
  const fichaVoley = getPosterior.body?.data?.ficha;

  console.log('\nEstado de deportes tras guardar Vóley:');
  console.table(deportesPosterior.map((d) => ({ id: d.id, name: d.name, activo: d.activo })));

  if (voleyPosterior?.activo === true) {
    console.log('\n✓ Vóley marcado como activo: true en GET posterior.');
  } else {
    console.error('\n✗ Vóley debería tener activo: true tras guardar.');
    process.exitCode = 1;
  }

  if (fichaVoley?.posicion_principal === 'ARMADOR' && fichaVoley?.dorsal_preferido === 7) {
    console.log('✓ Ficha de Vóley persistida correctamente.');
  } else {
    console.error('✗ Ficha de Vóley no coincide con lo guardado.');
    process.exitCode = 1;
  }

  const inactivosPosterior = deportesPosterior.filter((d) => !d.activo);
  console.log('\nDeportes disponibles en "Agregar" tras configurar Vóley:');
  console.log(inactivosPosterior.map((d) => d.name).join(', ') || '(ninguno)');

  if (
    inactivosPosterior.some((d) => d.name === 'Basquet') &&
    !inactivosPosterior.some((d) => d.name === 'Voley')
  ) {
    console.log('✓ Basquet sigue disponible para agregar; Vóley ya no.');
  } else {
    console.error('✗ Selector Agregar posterior incorrecto.');
    process.exitCode = 1;
  }

  console.log('\n=== Fin del script ===');
} catch (error) {
  console.error('Error en test-agregar-deporte-flow:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
