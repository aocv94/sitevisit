export interface Point {
  x: number;
  y: number;
}

/** Trazo rojo a mano alzada: señala el problema. */
export interface PenMark {
  type: 'pen';
  pts: Point[];
}

/** Rectangulo negro opaco: tapa caras, matriculas y datos sensibles. */
export interface RectMark {
  type: 'rect';
  x: number;
  y: number;
  x2: number;
  y2: number;
}

export type Mark = PenMark | RectMark;

export type MarkupMode = 'pen' | 'rect';
