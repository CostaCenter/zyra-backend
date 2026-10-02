const GENEROS_USUARIO = ['MASCULINO', 'FEMENINO', 'NO_ESPECIFICADO'];
const GENEROS_DIVISION = ['MASCULINO', 'FEMENINO', 'MIXTO'];

export const normalizarGeneroUsuario = (value) => {
  if (value == null || String(value).trim() === '') return null;
  const raw = String(value).trim().toUpperCase();
  if (raw === 'PREFIERO_NO_DECIRLO' || raw === 'PREFIERO NO DECIRLO') return 'NO_ESPECIFICADO';
  if (GENEROS_USUARIO.includes(raw)) return raw;
  return null;
};

export const calcularEdadDesdeFecha = (fechaNacimiento, refDate = new Date()) => {
  if (!fechaNacimiento) return null;
  const birth = fechaNacimiento instanceof Date
    ? fechaNacimiento
    : new Date(String(fechaNacimiento).slice(0, 10));
  if (Number.isNaN(birth.getTime())) return null;

  let age = refDate.getFullYear() - birth.getFullYear();
  const monthDiff = refDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
};

export const formatearRangoEdadDivision = (edadMinima, edadMaxima) => {
  if (edadMinima == null || edadMaxima == null) return null;
  return `${edadMinima} a ${edadMaxima} años`;
};

export const validarUsuarioParaDivision = (usuario, division) => {
  if (!usuario || !division) {
    return { ok: false, error: 'Datos incompletos para validar elegibilidad' };
  }

  const generoUsuario = normalizarGeneroUsuario(usuario.genero);
  const generoDivision = division.genero ? String(division.genero).toUpperCase() : null;

  if (generoDivision === 'FEMENINO' || generoDivision === 'MASCULINO') {
    if (!generoUsuario) {
      return {
        ok: false,
        error: 'El jugador debe indicar su género en el perfil para unirse a esta división',
      };
    }
    if (generoUsuario === 'NO_ESPECIFICADO') {
      return {
        ok: false,
        error: 'Esta división requiere indicar género (Masculino o Femenino) en tu perfil',
      };
    }
    if (generoUsuario !== generoDivision) {
      const label = generoDivision === 'FEMENINO' ? 'femenina' : 'masculina';
      return {
        ok: false,
        error: `Esta división es ${label} y el género del jugador no coincide`,
      };
    }
  }

  const edadMin = division.edad_minima != null ? Number(division.edad_minima) : null;
  const edadMax = division.edad_maxima != null ? Number(division.edad_maxima) : null;

  if (edadMin != null && edadMax != null) {
    const edad = calcularEdadDesdeFecha(usuario.fecha_nacimiento);
    if (edad == null) {
      return {
        ok: false,
        error: 'El jugador debe tener fecha de nacimiento registrada para unirse a esta división',
      };
    }
    if (edad < edadMin || edad > edadMax) {
      return {
        ok: false,
        error: `La edad del jugador (${edad} años) no está en el rango ${edadMin}–${edadMax} de la división`,
      };
    }
  }

  return { ok: true };
};
