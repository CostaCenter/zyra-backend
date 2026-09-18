export const SISTEMAS_TALLA = ['ROPA', 'CALZADO', 'PROTECCION'];

export const TALLAS_POR_SISTEMA = {
  ROPA: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  CALZADO: Array.from({ length: 13 }, (_, i) => String(34 + i)),
  PROTECCION: ['S', 'M', 'L', 'Única'],
};

export const ESTADOS_UNIFORME = ['NUEVO', 'BUEN_ESTADO', 'DESGASTADO', 'DAÑADO', 'REEMPLAZAR'];

export const ESTADOS_UNIFORME_ALERTA = ['DESGASTADO', 'DAÑADO', 'REEMPLAZAR'];

export const PRENDAS_SUGERIDAS_VOLEY = [
  { nombre: 'Camiseta', sistema_talla: 'ROPA' },
  { nombre: 'Pantaloneta', sistema_talla: 'ROPA' },
  { nombre: 'Medias', sistema_talla: 'ROPA' },
  { nombre: 'Rodilleras', sistema_talla: 'PROTECCION' },
];

export function tallaValidaParaSistema(sistemaTalla, talla) {
  const opciones = TALLAS_POR_SISTEMA[String(sistemaTalla || '').toUpperCase()];
  if (!opciones || !talla) return false;
  return opciones.includes(String(talla).trim());
}

export function estadoUniformeValido(estado) {
  return ESTADOS_UNIFORME.includes(String(estado || '').toUpperCase());
}
