import { describe, expect, it } from 'vitest';
import {
  applyPinch,
  IDENTITY_VIEW,
  MAX_PLAN_SCALE,
  MIN_PLAN_SCALE,
  normalizePinPosition,
  planImageToScreen,
  planScreenToImage,
  type PlanView,
} from './plan';

const canvas = { width: 800, height: 600 };

describe('transformadas del plano', () => {
  const views: PlanView[] = [
    IDENTITY_VIEW,
    { scale: 2, offsetX: 0, offsetY: 0 },
    { scale: 0.75, offsetX: 120, offsetY: -80 },
    { scale: 2.5, offsetX: -45, offsetY: 310 },
  ];

  it.each(views)('ida y vuelta es la identidad (scale $scale)', (view) => {
    const point = { x: 321, y: 187 };
    const roundTrip = planScreenToImage(planImageToScreen(point, canvas, view), canvas, view);
    expect(roundTrip.x).toBeCloseTo(point.x, 6);
    expect(roundTrip.y).toBeCloseTo(point.y, 6);
  });

  it('sin zoom ni desplazamiento no mueve nada', () => {
    const point = { x: 10, y: 20 };
    expect(planImageToScreen(point, canvas, IDENTITY_VIEW)).toEqual(point);
  });

  it('deja el centro del canvas fijo al hacer zoom', () => {
    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    const zoomed = planImageToScreen(center, canvas, { scale: 3, offsetX: 0, offsetY: 0 });
    expect(zoomed).toEqual(center);
  });
});

describe('normalizePinPosition', () => {
  it('normaliza a 0-1 respecto a la lamina', () => {
    const pin = normalizePinPosition({ x: 400, y: 150 }, canvas, IDENTITY_VIEW);
    expect(pin.x).toBeCloseTo(0.5, 6);
    expect(pin.y).toBeCloseTo(0.25, 6);
  });

  it('mantiene la coordenada con zoom y desplazamiento', () => {
    // El pin debe caer donde apunta el dedo, no donde caeria sin zoom.
    const view: PlanView = { scale: 2, offsetX: 30, offsetY: -15 };
    const imagePoint = { x: 200, y: 450 };
    const screen = planImageToScreen(imagePoint, canvas, view);
    const pin = normalizePinPosition(screen, canvas, view);
    expect(pin.x).toBeCloseTo(imagePoint.x / canvas.width, 6);
    expect(pin.y).toBeCloseTo(imagePoint.y / canvas.height, 6);
  });

  it('recorta a los bordes si el toque cae fuera', () => {
    expect(normalizePinPosition({ x: -500, y: 5000 }, canvas, IDENTITY_VIEW)).toEqual({
      x: 0,
      y: 1,
    });
  });
});

describe('applyPinch', () => {
  const center = { x: 100, y: 100 };

  it('no baja del zoom minimo', () => {
    const view = applyPinch({ scale: MIN_PLAN_SCALE, offsetX: 0, offsetY: 0 }, 0.1, center, center);
    expect(view.scale).toBe(MIN_PLAN_SCALE);
  });

  it('no sube del zoom maximo', () => {
    const view = applyPinch({ scale: MAX_PLAN_SCALE, offsetX: 0, offsetY: 0 }, 10, center, center);
    expect(view.scale).toBe(MAX_PLAN_SCALE);
  });

  it('multiplica la escala por el factor del gesto', () => {
    const view = applyPinch(IDENTITY_VIEW, 1.5, center, center);
    expect(view.scale).toBeCloseTo(1.5, 6);
  });

  it('desplaza el encuadre siguiendo al centro de la pinza', () => {
    const view = applyPinch(IDENTITY_VIEW, 2, { x: 150, y: 100 }, { x: 100, y: 100 });
    expect(view.offsetX).toBeCloseTo(-50, 6);
    expect(view.offsetY).toBeCloseTo(0, 6);
  });
});
