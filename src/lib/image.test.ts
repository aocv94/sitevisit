import { describe, expect, it } from 'vitest';
import { fitDimensions, squareCropRect } from './image';

describe('squareCropRect', () => {
  it('no recorta nada si ya es cuadrada', () => {
    expect(squareCropRect({ width: 400, height: 400 })).toEqual({ sx: 0, sy: 0, side: 400 });
  });

  it('recorta los laterales de una foto apaisada', () => {
    // 800x600 -> lado 600, sobran 200 de ancho: 100 por cada extremo.
    expect(squareCropRect({ width: 800, height: 600 })).toEqual({ sx: 100, sy: 0, side: 600 });
  });

  it('recorta arriba y abajo de una foto vertical', () => {
    expect(squareCropRect({ width: 600, height: 800 })).toEqual({ sx: 0, sy: 100, side: 600 });
  });

  it('descarta lo mismo por cada extremo', () => {
    const source = { width: 1500, height: 1000 };
    const { sx, side } = squareCropRect(source);
    expect(sx).toBeCloseTo(source.width - sx - side, 6);
  });
});

describe('fitDimensions', () => {
  it('reduce conservando la proporcion', () => {
    expect(fitDimensions({ width: 800, height: 600 }, 400, 400, false)).toEqual({
      width: 400,
      height: 300,
    });
  });

  it('no agranda cuando no se permite', () => {
    // La foto marcada nunca se estira: agrandarla solo la pixela.
    expect(fitDimensions({ width: 200, height: 100 }, 800, 800, false)).toEqual({
      width: 200,
      height: 100,
    });
  });

  it('agranda cuando se permite', () => {
    // El plano si llena el hueco disponible.
    expect(fitDimensions({ width: 200, height: 100 }, 800, 800, true)).toEqual({
      width: 800,
      height: 400,
    });
  });

  it('manda la dimension mas restrictiva', () => {
    expect(fitDimensions({ width: 800, height: 600 }, 800, 300, false)).toEqual({
      width: 400,
      height: 300,
    });
  });
});
