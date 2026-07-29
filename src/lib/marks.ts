import type { Mark } from '@/types/markup';

export const PEN_COLOR = '#e11d1d';
export const REDACTION_COLOR = '#0a0a0a';

/** Grosor del trazo relativo al ancho del canvas de dibujo. */
export function penWidth(canvasWidth: number): number {
  return Math.max(2.2, canvasWidth / 165);
}

/**
 * Pinta las marcas sobre un contexto.
 *
 * `scale` permite dibujar las mismas coordenadas en el canvas de pantalla
 * (scale 1) y al aplanar sobre la foto a resolucion completa (scale > 1).
 * `baseWidth` es siempre el ancho del canvas de PANTALLA, para que el grosor
 * del trazo se vea igual en los dos.
 */
export function paintMarks(
  ctx: CanvasRenderingContext2D,
  marks: readonly Mark[],
  scale: number,
  baseWidth: number
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const mark of marks) {
    if (mark.type === 'rect') {
      ctx.fillStyle = REDACTION_COLOR;
      ctx.fillRect(
        Math.min(mark.x, mark.x2) * scale,
        Math.min(mark.y, mark.y2) * scale,
        Math.abs(mark.x2 - mark.x) * scale,
        Math.abs(mark.y2 - mark.y) * scale
      );
      continue;
    }
    if (mark.pts.length < 2) continue;
    ctx.strokeStyle = PEN_COLOR;
    ctx.lineWidth = penWidth(baseWidth) * scale;
    ctx.beginPath();
    const [first, ...rest] = mark.pts;
    if (!first) continue;
    ctx.moveTo(first.x * scale, first.y * scale);
    for (const p of rest) ctx.lineTo(p.x * scale, p.y * scale);
    ctx.stroke();
  }
}

/** Un rectangulo minusculo suele ser un toque accidental, no una redaccion. */
export const MIN_RECT_EDGE = 6;

export function isMeaningfulMark(mark: Mark): boolean {
  if (mark.type === 'rect') {
    return Math.abs(mark.x2 - mark.x) > MIN_RECT_EDGE && Math.abs(mark.y2 - mark.y) > MIN_RECT_EDGE;
  }
  return mark.pts.length > 1;
}
