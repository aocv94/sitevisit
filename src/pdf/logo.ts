/** Marca de Constellation, rasterizada para incrustarla en el PDF. */

const LOGO_PATH =
  'M246.61,0H113.39L0,331.73h360L246.61,0ZM177.17,21.57h5.66l87.73,257.02H89.43L177.17,21.57Z';

const LOGO_VIEWBOX = { width: 360, height: 331.73 };

/**
 * jsPDF no dibuja SVG, asi que el logo se pinta en un canvas y se incrusta
 * como PNG. Devuelve null si el canvas no esta disponible; el PDF sale igual,
 * solo sin logotipo.
 */
export function renderLogoPng(color = '#7ba7af', scale = 0.6): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(LOGO_VIEWBOX.width * scale);
    canvas.height = Math.round(LOGO_VIEWBOX.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(LOGO_PATH));
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
