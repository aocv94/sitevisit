import { planById, planUrl } from '@/config/project';
import type { Point } from '@/types/markup';
import type { PlanPin } from '@/types/report';

/** Estado de encuadre de la lamina: zoom y desplazamiento. */
export interface PlanView {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const IDENTITY_VIEW: PlanView = { scale: 1, offsetX: 0, offsetY: 0 };

export const MIN_PLAN_SCALE = 0.5;
export const MAX_PLAN_SCALE = 3;

/**
 * Transformada centrada, la misma que usa el pintado de la lamina. Que el
 * dibujo y el calculo de coordenadas compartan formula es lo que hace que el
 * pin caiga donde el dedo lo puso a cualquier zoom.
 */
export function planImageToScreen(
  p: Point,
  canvas: { width: number; height: number },
  view: PlanView
): Point {
  return {
    x: canvas.width / 2 + view.scale * (p.x - canvas.width / 2 + view.offsetX),
    y: canvas.height / 2 + view.scale * (p.y - canvas.height / 2 + view.offsetY),
  };
}

export function planScreenToImage(
  p: Point,
  canvas: { width: number; height: number },
  view: PlanView
): Point {
  return {
    x: (p.x - canvas.width / 2) / view.scale + canvas.width / 2 - view.offsetX,
    y: (p.y - canvas.height / 2) / view.scale + canvas.height / 2 - view.offsetY,
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Normaliza a 0-1 respecto a la lamina. Guardar asi (y no en pixeles) es lo
 * que permite reemplazar el JPEG del plano por uno de otra resolucion sin
 * mover los pines ya colocados en reportes anteriores.
 */
export function normalizePinPosition(
  screen: Point,
  canvas: { width: number; height: number },
  view: PlanView
): Point {
  const img = planScreenToImage(screen, canvas, view);
  return { x: clamp01(img.x / canvas.width), y: clamp01(img.y / canvas.height) };
}

/** Aplica un gesto de pinza manteniendo fijo el punto entre los dos dedos. */
export function applyPinch(
  view: PlanView,
  scaleFactor: number,
  center: Point,
  lastCenter: Point
): PlanView {
  const scale = Math.min(MAX_PLAN_SCALE, Math.max(MIN_PLAN_SCALE, view.scale * scaleFactor));
  return {
    scale,
    offsetX: view.offsetX + (center.x - lastCenter.x) * (1 - scaleFactor),
    offsetY: view.offsetY + (center.y - lastCenter.y) * (1 - scaleFactor),
  };
}

/** Diana roja numerada. Es la marca que el contratista busca en el key plan. */
export function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  num: number | null
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(225,29,29,.88)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - r * 1.9, y);
  ctx.lineTo(x - r * 1.15, y);
  ctx.moveTo(x + r * 1.15, y);
  ctx.lineTo(x + r * 1.9, y);
  ctx.moveTo(x, y - r * 1.9);
  ctx.lineTo(x, y - r * 1.15);
  ctx.moveTo(x, y + r * 1.15);
  ctx.lineTo(x, y + r * 1.9);
  ctx.strokeStyle = 'rgba(225,29,29,.9)';
  ctx.lineWidth = Math.max(1.2, r * 0.2);
  ctx.stroke();

  if (num != null) {
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 1.25)}px Archivo, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), x, y + r * 0.05);
  }
  ctx.restore();
}

export interface Keyplan {
  url: string;
  width: number;
  height: number;
}

const KEYPLAN_MAX_EDGE = 900;

/** Lamina recortada con el pin numerado, tal y como se incrusta en el PDF. */
export function renderKeyplan(
  planImage: HTMLImageElement,
  pin: PlanPin,
  itemNo: number | null
): Keyplan | null {
  try {
    const k = Math.min(1, KEYPLAN_MAX_EDGE / Math.max(planImage.width, planImage.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(planImage.width * k);
    canvas.height = Math.round(planImage.height * k);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Fondo blanco: el JPEG no tiene alfa y un plano con transparencias
    // saldria sobre negro.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(planImage, 0, 0, canvas.width, canvas.height);
    drawPin(
      ctx,
      pin.x * canvas.width,
      pin.y * canvas.height,
      Math.max(11, canvas.width / 26),
      itemNo
    );
    return { url: canvas.toDataURL('image/jpeg', 0.8), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/**
 * Cache de laminas. Memoriza tambien los fallos (null) para no reintentar en
 * bucle una lamina que no esta en el repo y para poder marcar su chip.
 */
const planImageCache = new Map<string, HTMLImageElement | null>();

export function cachedPlanImage(id: string): HTMLImageElement | null | undefined {
  return planImageCache.get(id);
}

export function loadPlanImage(id: string): Promise<HTMLImageElement | null> {
  const cached = planImageCache.get(id);
  if (cached !== undefined) return Promise.resolve(cached);

  const def = planById(id);
  if (!def) {
    planImageCache.set(id, null);
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      planImageCache.set(id, img);
      resolve(img);
    };
    img.onerror = () => {
      planImageCache.set(id, null);
      resolve(null);
    };
    img.src = planUrl(def);
  });
}

export function missingPlanMessage(id: string): string {
  const def = planById(id);
  return def
    ? `No image found at ${planUrl(def)} - add it to the repo.`
    : `Plan ${id} is not declared in PLANS[].`;
}
