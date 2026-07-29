/** Helpers de canvas/imagen. Todo lo que toca pixeles vive aqui. */

export const CAPTURE_MAX_EDGE = 1500;
export const CAPTURE_QUALITY = 0.65;
export const FLATTEN_QUALITY = 0.72;
export const THUMB_SIZE = 150;
export const THUMB_QUALITY = 0.5;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file would not open as an image'));
    img.src = src;
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  return ctx;
}

/**
 * Reescala la foto recien capturada. Sin esto una foto de telefono moderno son
 * varios MB en base64 y el localStorage se llena con tres items.
 */
export function downscaleToDataUrl(
  img: HTMLImageElement,
  maxEdge: number = CAPTURE_MAX_EDGE,
  quality: number = CAPTURE_QUALITY
): string {
  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const k = maxEdge / longest;
    width = Math.round(width * k);
    height = Math.round(height * k);
  }
  const canvas = createCanvas(width, height);
  context2d(canvas).drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Rota `dataUrl` en multiplos de 90.
 *
 * Quien llame debe pasar SIEMPRE la imagen original y el angulo acumulado, no
 * la imagen ya rotada: rotar sobre lo rotado recomprime el JPEG en cada vuelta
 * y arrastra el error.
 */
export async function rotateDataUrl(
  dataUrl: string,
  degrees: number,
  quality: number = FLATTEN_QUALITY
): Promise<string> {
  const img = await loadImage(dataUrl);
  const quarterTurn = degrees === 90 || degrees === 270;
  const canvasW = quarterTurn ? img.height : img.width;
  const canvasH = quarterTurn ? img.width : img.height;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = context2d(canvas);
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Recorte cuadrado centrado, tipo `cover`: el lado mas corto manda y del
 * largo se descarta la misma cantidad por cada extremo.
 */
export function squareCropRect(source: { width: number; height: number }): {
  sx: number;
  sy: number;
  side: number;
} {
  const side = Math.min(source.width, source.height);
  return { sx: (source.width - side) / 2, sy: (source.height - side) / 2, side };
}

/**
 * Miniatura para la columna PHOTO de la tabla resumen del PDF.
 *
 * Se genera desde la foto SIN marcas: la tabla resumen es un indice visual, el
 * detalle marcado va en su ficha.
 *
 * Recorta al centro en vez de estirar. Estirando, una foto apaisada salia
 * achatada en la tabla y costaba reconocerla; el recorte pierde los bordes
 * pero mantiene las proporciones, que es lo que hace la miniatura util como
 * indice. La foto completa y sin recortar sigue en la ficha de detalle.
 */
export function makeThumbnail(
  img: HTMLImageElement | HTMLCanvasElement,
  size: number = THUMB_SIZE,
  quality: number = THUMB_QUALITY
): string {
  const canvas = createCanvas(size, size);
  const { sx, sy, side } = squareCropRect(img);
  context2d(canvas).drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Aplana la foto con sus marcas encima a la resolucion original.
 *
 * Destructivo por diseño: los rectangulos negros son redaccion, no una capa.
 * Lo tapado no se puede recuperar del resultado, que es justo lo que se quiere.
 */
export function flattenWithOverlay(
  base: HTMLImageElement,
  paint: (ctx: CanvasRenderingContext2D, scale: number) => void,
  displayWidth: number,
  quality: number = FLATTEN_QUALITY
): string {
  const canvas = createCanvas(base.width, base.height);
  const ctx = context2d(canvas);
  ctx.drawImage(base, 0, 0);
  paint(ctx, base.width / displayWidth);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Encaja `source` dentro de un maximo conservando proporcion.
 * `allowUpscale` distingue los dos casos que ya existian: la foto marcada
 * nunca se agranda, el plano si se estira hasta llenar el hueco.
 */
export function fitDimensions(
  source: { width: number; height: number },
  maxWidth: number,
  maxHeight: number,
  allowUpscale: boolean
): { width: number; height: number } {
  const ratios = [maxWidth / source.width, maxHeight / source.height];
  if (!allowUpscale) ratios.push(1);
  const k = Math.min(...ratios);
  return { width: Math.round(source.width * k), height: Math.round(source.height * k) };
}

/** Caja de dibujo que usan las dos hojas modales. */
export function sheetCanvasBounds(): { maxWidth: number; maxHeight: number } {
  return {
    maxWidth: Math.min(window.innerWidth * 1.5, 840),
    maxHeight: Math.round(window.innerHeight * 0.6),
  };
}
