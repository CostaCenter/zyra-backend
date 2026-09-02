import sequelize from '../src/config/database.js';
import { User, Sports, UsuarioStatsPorSport } from '../src/db/db.js';
import {
  getMiPerfilDeportivo,
  updateMiPerfilDeportivo
} from '../src/controllers/perfilDeportivoController.js';

const TEST_USER_ID = 1;

const crearMockRes = () => {
  const res = {
    statusCode: 200,
    body: null
  };

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

const obtenerUsuarioYDeporte = async () => {
  const usuario = await User.findByPk(TEST_USER_ID);
  if (!usuario) {
    throw new Error(`Usuario id=${TEST_USER_ID} no existe.`);
  }

  const deporte = await Sports.findOne({ order: [['id', 'ASC']] });
  if (!deporte) {
    throw new Error('No hay deportes en la base de datos.');
  }

  return { usuario, deporte };
};

try {
  console.log('=== test-perfil-deportivo ===\n');

  const { usuario, deporte } = await obtenerUsuarioYDeporte();
  console.log(`Usuario de prueba: id=${usuario.id}, nick=${usuario.nick ?? '(sin nick)'}`);
  console.log(`Deporte de prueba: id=${deporte.id}, name=${deporte.name}\n`);

  await UsuarioStatsPorSport.destroy({
    where: {
      user_id: usuario.id,
      sport_id: deporte.id
    }
  });
  console.log(`Ficha previa eliminada para user_id=${usuario.id}, sport_id=${deporte.id}\n`);

  console.log('--- GET inicial (sin ficha, debe devolver defaults) ---');
  const getInicial = await invocarController(getMiPerfilDeportivo, {
    userId: usuario.id,
    query: { sport_id: String(deporte.id) }
  });
  console.log(`HTTP ${getInicial.statusCode}`);
  console.log(JSON.stringify(getInicial.body, null, 2));

  console.log('\n--- PUT crear/actualizar ficha ---');
  const payload = {
    sport_id: deporte.id,
    posicion_principal: 'DELANTERO',
    pierna_habil: 'DERECHA',
    dorsal_preferido: 10
  };

  const putResultado = await invocarController(updateMiPerfilDeportivo, {
    userId: usuario.id,
    body: payload
  });
  console.log(`HTTP ${putResultado.statusCode}`);
  console.log(JSON.stringify(putResultado.body, null, 2));

  console.log('\n--- GET posterior (debe reflejar la ficha guardada) ---');
  const getFinal = await invocarController(getMiPerfilDeportivo, {
    userId: usuario.id,
    query: { sport_id: String(deporte.id) }
  });
  console.log(`HTTP ${getFinal.statusCode}`);
  console.log(JSON.stringify(getFinal.body, null, 2));

  const ficha = getFinal.body?.data?.ficha;
  const deporteActivo = getFinal.body?.data?.deportes?.find((item) => item.id === deporte.id);

  if (ficha?.posicion_principal === payload.posicion_principal &&
      ficha?.pierna_habil === payload.pierna_habil &&
      ficha?.dorsal_preferido === payload.dorsal_preferido &&
      ficha?.configurado === true) {
    console.log('\n✓ Ficha persistida correctamente.');
  } else {
    console.error('\n✗ La ficha guardada no coincide con lo enviado.');
    process.exitCode = 1;
  }

  if (deporteActivo?.activo === true) {
    console.log('✓ Deporte marcado como activo en el selector.');
  } else {
    console.error('✗ El deporte no aparece como activo en el selector.');
    process.exitCode = 1;
  }

  console.log('\n=== Fin del script ===');
} catch (error) {
  console.error('Error en test-perfil-deportivo:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}

