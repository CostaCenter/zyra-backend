import {
  Clubs,
  ClubDestacados,
  ClubDestacadoItems,
} from '../db/db.js';
import { usuarioEsAdminClub } from './clubsService.js';
import {
  subirImagenPerfil,
  subirMediaPublicacion,
  inferirTipoPublicacion,
} from './cloudinaryService.js';

const parseId = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const asegurarAdminClub = async (clubId, userId) => {
  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
  if (!club) {
    const err = new Error('Club no encontrado');
    err.status = 404;
    throw err;
  }
  if (!usuarioEsAdminClub(club, userId)) {
    const err = new Error('Solo el administrador del club puede gestionar destacados');
    err.status = 403;
    throw err;
  }
  return club;
};

const asegurarDestacadoClub = async (clubId, destacadoId) => {
  const destacado = await ClubDestacados.findOne({
    where: { id: destacadoId, club_id: clubId },
  });
  if (!destacado) {
    const err = new Error('Destacado no encontrado');
    err.status = 404;
    throw err;
  }
  return destacado;
};

const formatearDestacado = (destacado) => {
  const json = destacado.toJSON ? destacado.toJSON() : destacado;
  const items = (json.items ?? []).slice().sort((a, b) => a.orden - b.orden);
  return {
    ...json,
    duracion_segundos: json.duracion_segundos != null ? Number(json.duracion_segundos) : json.duracion_segundos,
    items: items.map((item) => ({
      ...item,
      duracion_segundos: item.duracion_segundos != null ? Number(item.duracion_segundos) : 5,
    })),
  };
};

export const listarDestacadosClub = async (clubId) => {
  const id = parseId(clubId);
  if (!id) {
    const err = new Error('club_id inválido');
    err.status = 400;
    throw err;
  }

  const club = await Clubs.findByPk(id, { attributes: ['id'] });
  if (!club) {
    const err = new Error('Club no encontrado');
    err.status = 404;
    throw err;
  }

  const destacados = await ClubDestacados.findAll({
    where: { club_id: id },
    include: [{
      model: ClubDestacadoItems,
      as: 'items',
      separate: true,
      order: [['orden', 'ASC'], ['id', 'ASC']],
    }],
    order: [['orden', 'ASC'], ['id', 'ASC']],
  });

  return destacados.map(formatearDestacado);
};

export const crearDestacadoClub = async (clubId, userId, { nombre, orden }, portadaFile) => {
  const id = parseId(clubId);
  if (!id) {
    const err = new Error('club_id inválido');
    err.status = 400;
    throw err;
  }

  const nombreLimpio = String(nombre ?? '').trim();
  if (!nombreLimpio) {
    const err = new Error('El nombre del destacado es obligatorio');
    err.status = 400;
    throw err;
  }

  await asegurarAdminClub(id, userId);

  let iconoPortadaUrl = null;
  if (portadaFile?.buffer?.length) {
    const upload = await subirImagenPerfil(portadaFile, 'clubes/destacados');
    iconoPortadaUrl = upload.secure_url;
  }

  let ordenFinal = Number.isFinite(Number(orden)) ? Number(orden) : null;
  if (ordenFinal == null) {
    const maxOrden = await ClubDestacados.max('orden', { where: { club_id: id } });
    ordenFinal = Number.isFinite(maxOrden) ? maxOrden + 1 : 0;
  }

  const destacado = await ClubDestacados.create({
    club_id: id,
    nombre: nombreLimpio.slice(0, 100),
    icono_portada_url: iconoPortadaUrl,
    orden: ordenFinal,
  });

  const completo = await ClubDestacados.findByPk(destacado.id, {
    include: [{ model: ClubDestacadoItems, as: 'items' }],
  });

  return formatearDestacado(completo);
};

export const actualizarDestacadoClub = async (
  clubId,
  destacadoId,
  userId,
  { nombre, orden },
  portadaFile,
) => {
  const id = parseId(clubId);
  const destId = parseId(destacadoId);
  if (!id || !destId) {
    const err = new Error('Identificador inválido');
    err.status = 400;
    throw err;
  }

  await asegurarAdminClub(id, userId);
  const destacado = await asegurarDestacadoClub(id, destId);

  const updates = {};
  if (nombre != null) {
    const nombreLimpio = String(nombre).trim();
    if (!nombreLimpio) {
      const err = new Error('El nombre no puede estar vacío');
      err.status = 400;
      throw err;
    }
    updates.nombre = nombreLimpio.slice(0, 100);
  }
  if (Number.isFinite(Number(orden))) {
    updates.orden = Number(orden);
  }
  if (portadaFile?.buffer?.length) {
    const upload = await subirImagenPerfil(portadaFile, 'clubes/destacados');
    updates.icono_portada_url = upload.secure_url;
  }

  if (Object.keys(updates).length > 0) {
    await destacado.update(updates);
  }

  const completo = await ClubDestacados.findByPk(destacado.id, {
    include: [{
      model: ClubDestacadoItems,
      as: 'items',
      separate: true,
      order: [['orden', 'ASC'], ['id', 'ASC']],
    }],
  });

  return formatearDestacado(completo);
};

export const eliminarDestacadoClub = async (clubId, destacadoId, userId) => {
  const id = parseId(clubId);
  const destId = parseId(destacadoId);
  if (!id || !destId) {
    const err = new Error('Identificador inválido');
    err.status = 400;
    throw err;
  }

  await asegurarAdminClub(id, userId);
  const destacado = await asegurarDestacadoClub(id, destId);
  await destacado.destroy();
  return true;
};

export const agregarItemDestacado = async (clubId, destacadoId, userId, mediaFile) => {
  const id = parseId(clubId);
  const destId = parseId(destacadoId);
  if (!id || !destId) {
    const err = new Error('Identificador inválido');
    err.status = 400;
    throw err;
  }

  if (!mediaFile?.buffer?.length) {
    const err = new Error('El archivo de media es obligatorio');
    err.status = 400;
    throw err;
  }

  await asegurarAdminClub(id, userId);
  const destacado = await asegurarDestacadoClub(id, destId);

  const upload = await subirMediaPublicacion(mediaFile);
  const tipoRaw = inferirTipoPublicacion(mediaFile.mimetype, mediaFile.originalname);
  const tipo = tipoRaw === 'VIDEO' ? 'VIDEO' : 'IMAGEN';
  const duracionSegundos = tipo === 'VIDEO'
    ? Math.max(1, Math.round((upload.duration ?? 5) * 100) / 100)
    : 5;

  const maxOrden = await ClubDestacadoItems.max('orden', {
    where: { destacado_id: destId },
  });
  const orden = Number.isFinite(maxOrden) ? maxOrden + 1 : 0;

  const item = await ClubDestacadoItems.create({
    destacado_id: destId,
    tipo,
    url: upload.secure_url,
    duracion_segundos: duracionSegundos,
    orden,
  });

  if (!destacado.icono_portada_url && tipo === 'IMAGEN') {
    await destacado.update({ icono_portada_url: upload.secure_url });
  }

  return {
    ...item.toJSON(),
    duracion_segundos: Number(item.duracion_segundos),
  };
};

export const eliminarItemDestacado = async (clubId, destacadoId, itemId, userId) => {
  const id = parseId(clubId);
  const destId = parseId(destacadoId);
  const itId = parseId(itemId);
  if (!id || !destId || !itId) {
    const err = new Error('Identificador inválido');
    err.status = 400;
    throw err;
  }

  await asegurarAdminClub(id, userId);
  await asegurarDestacadoClub(id, destId);

  const item = await ClubDestacadoItems.findOne({
    where: { id: itId, destacado_id: destId },
  });
  if (!item) {
    const err = new Error('Item no encontrado');
    err.status = 404;
    throw err;
  }

  await item.destroy();
  return true;
};

export const reordenarDestacadosClub = async (clubId, userId, ordenes = []) => {
  const id = parseId(clubId);
  if (!id) {
    const err = new Error('club_id inválido');
    err.status = 400;
    throw err;
  }

  await asegurarAdminClub(id, userId);

  if (!Array.isArray(ordenes) || ordenes.length === 0) {
    const err = new Error('Se requiere un arreglo de ordenes');
    err.status = 400;
    throw err;
  }

  await Promise.all(ordenes.map(({ id: destId, orden }) => {
    if (!parseId(destId) || !Number.isFinite(Number(orden))) return Promise.resolve();
    return ClubDestacados.update(
      { orden: Number(orden) },
      { where: { id: destId, club_id: id } },
    );
  }));

  return listarDestacadosClub(id);
};
