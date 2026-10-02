import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Complejos } from '../db/db.js';
import { mapUserForClient } from '../utils/userAvatar.js';
import { normalizarGeneroUsuario } from '../utils/divisionEligibility.js';

/**
 * Servicio de Autenticación - Zyra
 * Login móvil y login dashboard separados.
 */

const complejosInclude = [
  {
    model: Complejos,
    as: 'complejosConAcceso',
    through: {
      attributes: ['rol_en_complejo', 'creado_at']
    },
    attributes: ['id', 'nombre', 'ubicacion', 'photo', 'wallpaper']
  }
];

const findUserByTelefono = async (telefono, { withComplejos = false } = {}) => {
  return User.findOne({
    where: { telefono },
    include: withComplejos ? complejosInclude : []
  });
};

const assertPasswordValid = async (user, password) => {
  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Credenciales inválidas');
  }
};

const buildAuthResponse = async (user, { withComplejos = false } = {}) => {
  await user.update({ last_login: new Date() });

  const token = jwt.sign(
    {
      id: user.id,
      telefono: user.telefono,
      nick: user.nick,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { password_hash: _, ...userWithoutPassword } = user.toJSON();
  const userForClient = {
    ...userWithoutPassword,
    ...mapUserForClient(userWithoutPassword),
  };

  if (!withComplejos) {
    return { token, user: userForClient };
  }

  return {
    token,
    user: {
      ...userForClient,
      complejos: userWithoutPassword.complejosConAcceso || []
    }
  };
};

/**
 * Registrar un nuevo usuario
 */
export const registerUser = async (userData) => {
  const {
    telefono,
    password,
    nick,
    name,
    photo,
    role,
    fecha_nacimiento: fechaNacimiento,
    genero,
  } = userData;

  const generoNorm = normalizarGeneroUsuario(genero);
  if (!generoNorm) {
    throw new Error('genero debe ser MASCULINO, FEMENINO o NO_ESPECIFICADO');
  }

  const fechaRaw = fechaNacimiento ? String(fechaNacimiento).slice(0, 10) : null;
  if (!fechaRaw || Number.isNaN(new Date(fechaRaw).getTime())) {
    throw new Error('fecha_nacimiento es obligatoria y debe ser válida');
  }

  const birth = new Date(fechaRaw);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  if (age < 5 || age > 99) {
    throw new Error('La fecha de nacimiento debe corresponder a una edad entre 5 y 99 años');
  }

  const existingUser = await User.findOne({
    where: {
      [User.sequelize.Sequelize.Op.or]: [
        { telefono },
        { nick: nick || null }
      ]
    }
  });

  if (existingUser) {
    if (existingUser.telefono === telefono) {
      throw new Error('El teléfono ya está registrado');
    }
    if (existingUser.nick === nick) {
      throw new Error('El nick ya está en uso');
    }
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const normalizedRole = role === 'player' ? 'JUGADOR' : (role || 'JUGADOR');

  const newUser = await User.create({
    telefono,
    password_hash: hashedPassword,
    nick,
    name,
    photo,
    role: normalizedRole,
    status: 'ACTIVO',
    fecha_nacimiento: fechaRaw,
    genero: generoNorm,
  });

  return buildAuthResponse(newUser);
};

/**
 * Login para la app móvil (jugadores y cualquier rol)
 */
export const loginUser = async (telefono, password) => {
  const user = await findUserByTelefono(telefono);
  await assertPasswordValid(user, password);
  return buildAuthResponse(user);
};

/**
 * Login para el dashboard web (solo staff con complejos asignados)
 */
export const loginDashboardUser = async (telefono, password) => {
  const user = await findUserByTelefono(telefono, { withComplejos: true });
  await assertPasswordValid(user, password);

  if (user.role === 'JUGADOR') {
    throw new Error('Los jugadores no tienen acceso al dashboard');
  }

  if (!user.complejosConAcceso || user.complejosConAcceso.length === 0) {
    throw new Error('No tienes complejos asignados. Contacta al administrador');
  }

  return buildAuthResponse(user, { withComplejos: true });
};
