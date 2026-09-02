import { Complejos, User, Canchas, ComplejoHorarios, Sports } from '../db/db.js';

/**
 * Servicio de Complejos - Zyra
 * Maneja la lógica de negocio para los complejos deportivos
 */

/**
 * Crear un nuevo complejo
 * @param {Object} complexData - Datos del complejo
 * @returns {Promise<Object>} Complejo creado
 */
export const createComplex = async (complexData) => {
  const { nombre, ubicacion, dueño_id, photo, wallpaper } = complexData;

  // Validar que el dueño existe
  const owner = await User.findByPk(dueño_id);
  if (!owner) {
    throw new Error('El usuario dueño no existe');
  }

  // Crear el complejo
  const newComplex = await Complejos.create({
    nombre,
    ubicacion,
    dueño_id,
    photo,
    wallpaper
  });

  return newComplex;
};

/**
 * Obtener todos los complejos de un dueño específico
 * @param {number} ownerId - ID del dueño
 * @returns {Promise<Array>} Lista de complejos del dueño
 */
export const getComplexesByOwner = async (ownerId) => {
  const complexes = await Complejos.findAll({
    where: { dueño_id: ownerId },
    include: [
      {
        model: User,
        as: 'dueño',
        attributes: ['id', 'name', 'nick', 'telefono', 'photo']
      }
    ],
    order: [['id', 'DESC']]
  });

  return complexes;
};

/**
 * Obtener todos los complejos (público)
 * @returns {Promise<Array>} Lista de todos los complejos
 */
export const getAllComplexes = async () => {
  const complexes = await Complejos.findAll({
    include: [
      {
        model: User,
        as: 'dueño',
        attributes: ['id', 'name', 'nick', 'photo']
      }
    ],
    order: [['id', 'DESC']]
  });

  return complexes;
};

/**
 * Obtener un complejo por ID con información completa
 * @param {number} complexId - ID del complejo
 * @returns {Promise<Object>} Complejo encontrado con canchas y horarios
 */
export const getComplexById = async (complexId) => {
  const complex = await Complejos.findByPk(complexId, {
    include: [
      {
        model: User,
        as: 'dueño',
        attributes: ['id', 'name', 'nick', 'telefono', 'photo']
      },
      {
        model: Canchas,
        as: 'canchas',
        attributes: ['id', 'nombre', 'tipo_deporte', 'precio_hora', 'state', 'photo', 'sport_id'],
        include: [
          {
            model: Sports,
            as: 'sport',
            attributes: ['id', 'name', 'state']
          }
        ]
      },
      {
        model: ComplejoHorarios,
        as: 'horarios',
        attributes: ['id', 'dia_semana', 'hora_apertura', 'hora_cierre', 'esta_cerrado'],
        order: [['dia_semana', 'ASC']]
      }
    ]
  });

  if (!complex) {
    throw new Error('Complejo no encontrado');
  }

  return complex;
};

/**
 * Actualizar un complejo
 * @param {number} complexId - ID del complejo
 * @param {number} ownerId - ID del dueño (para verificar permisos)
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} Complejo actualizado
 */
export const updateComplex = async (complexId, ownerId, updateData) => {
  const complex = await Complejos.findByPk(complexId);

  if (!complex) {
    throw new Error('Complejo no encontrado');
  }

  // Verificar que el usuario es el dueño
  if (complex.dueño_id !== ownerId) {
    throw new Error('No tienes permiso para editar este complejo');
  }

  // Actualizar el complejo
  await complex.update(updateData);

  return complex;
};

/**
 * Eliminar un complejo
 * @param {number} complexId - ID del complejo
 * @param {number} ownerId - ID del dueño (para verificar permisos)
 * @returns {Promise<void>}
 */
export const deleteComplex = async (complexId, ownerId) => {
  const complex = await Complejos.findByPk(complexId);

  if (!complex) {
    throw new Error('Complejo no encontrado');
  }

  // Verificar que el usuario es el dueño
  if (complex.dueño_id !== ownerId) {
    throw new Error('No tienes permiso para eliminar este complejo');
  }

  await complex.destroy();
};
