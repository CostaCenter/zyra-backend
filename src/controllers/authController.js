import { registerUser, loginUser, loginDashboardUser } from '../services/authService.js';
import { eliminarDispositivoPush } from '../services/dispositivosPushService.js';

/**
 * Controller de Autenticación - Zyra
 * Maneja las peticiones HTTP de registro y login
 */

/**
 * POST /auth/register
 * Registrar un nuevo usuario
 */
export const register = async (req, res) => {
  try {
    const { telefono, password, nick, name, photo, role } = req.body;

    // Validaciones básicas
    if (!telefono || !password) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono y password son obligatorios'
      });
    }

    // Validar formato de teléfono (básico)
    const telefonoRegex = /^[0-9+\-\s()]+$/;
    if (!telefonoRegex.test(telefono)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de teléfono inválido'
      });
    }

    // Validar longitud de password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Registrar usuario (el servicio ya devuelve token y user)
    const { token, user } = await registerUser({
      telefono,
      password,
      nick,
      name,
      photo,
      role
    });

    // Enviar la misma estructura que el login
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user
    });

  } catch (error) {
    console.error('Error en registro:', error);

    // Errores específicos
    if (error.message.includes('ya está registrado') || error.message.includes('ya está en uso')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /auth/login
 * Iniciar sesión
 */
export const login = async (req, res) => {
  try {
    const { telefono, password } = req.body;

    // Validaciones básicas
    if (!telefono || !password) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono y password son obligatorios'
      });
    }

    // Autenticar usuario
    const { token, user } = await loginUser(telefono, password);

    // Enviar la misma estructura que el registro
    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      token,
      user
    });

  } catch (error) {
    console.error('Error en login:', error);

    // Credenciales inválidas
    if (error.message === 'Credenciales inválidas') {
      return res.status(401).json({
        success: false,
        message: 'Teléfono o contraseña incorrectos'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /auth/login/dashboard
 * Iniciar sesión en el panel web
 */
export const loginDashboard = async (req, res) => {
  try {
    const { telefono, password } = req.body;

    if (!telefono || !password) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono y password son obligatorios'
      });
    }

    const { token, user } = await loginDashboardUser(telefono, password);

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      token,
      user
    });

  } catch (error) {
    console.error('Error en login dashboard:', error);

    if (error.message === 'Credenciales inválidas') {
      return res.status(401).json({
        success: false,
        message: 'Teléfono o contraseña incorrectos'
      });
    }

    if (
      error.message === 'Los jugadores no tienen acceso al dashboard' ||
      error.message === 'No tienes complejos asignados. Contacta al administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /auth/logout
 * Cierra sesión en el cliente. Opcionalmente elimina el push token del dispositivo.
 */
export const logout = async (req, res) => {
  try {
    const pushToken = req.body?.push_token;

    if (pushToken && req.userId) {
      try {
        await eliminarDispositivoPush(req.userId, pushToken);
      } catch (pushError) {
        console.warn('Logout: no se pudo eliminar push token:', pushError?.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Sesión cerrada',
    });
  } catch (error) {
    console.error('Error en logout:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
