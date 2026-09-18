export function mapUserForClient(user) {
  if (!user) return null;

  const json = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const fotoPortada = json.foto_portada_url?.trim() || null;
  const photoLegacy = json.photo?.trim() || null;

  return {
    id: json.id,
    nick: json.nick,
    name: json.name,
    photo: fotoPortada || photoLegacy,
    foto_portada_url: fotoPortada,
  };
}

export const USER_PUBLIC_ATTRIBUTES = ['id', 'nick', 'name', 'photo', 'foto_portada_url'];
