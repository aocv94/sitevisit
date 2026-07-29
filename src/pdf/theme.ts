/** Identidad y retícula del PDF. Los valores son puntos (unidad de jsPDF). */

export type Rgb = readonly [number, number, number];

export const INK: Rgb = [20, 32, 43];
export const MARK: Rgb = [123, 167, 175];
export const MID: Rgb = [109, 118, 128];
export const HAIR: Rgb = [214, 213, 208];
export const PAPER: Rgb = [245, 244, 241];
export const BODY_TEXT: Rgb = [35, 45, 55];
export const META_TEXT: Rgb = [160, 168, 175];
export const FOOTER_TEXT: Rgb = [150, 158, 166];
export const SUBHEAD_TEXT: Rgb = [150, 165, 172];
export const KEYPLAN_LABEL: Rgb = [93, 137, 145];
export const TABLE_HEAD_FILL: Rgb = [236, 235, 231];

/** Carta, vertical. */
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
export const MARGIN = 54;
/** Alto reservado al pie legal, que va en todas las paginas. */
export const FOOTER_RESERVE = 64;

/** Tabla resumen. */
export const SUMMARY_THUMB_H = 62;
export const SUMMARY_THUMB_W = 78;
export const SUMMARY_TEXT_X = MARGIN + 124;
export const SUMMARY_LINE_HEIGHT = 11.5;

/** Fichas de detalle: dos por pagina. */
export const DETAIL_TOP = 78;
export const DETAIL_SLOTS_PER_PAGE = 2;
export const DETAIL_MAX_LINES = 5;
export const KEYPLAN_WIDTH = 132;
export const KEYPLAN_GAP = 14;

/**
 * Pie legal. Va en TODAS las paginas y no es decorativo: es lo que permite
 * mandar este PDF sin que se lea como una instruccion de cambio de alcance.
 */
export const LEGAL_LINES = [
  'Observations recorded during a general site visit. Not an exhaustive inspection and not a directive to change contract scope, schedule, or cost.',
  'Neither the inclusion nor the omission of an item constitutes approval, acceptance, or rejection of the Work.',
] as const;
