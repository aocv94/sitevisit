/**
 * Forma del reporte tal y como se persiste.
 *
 * IMPORTANTE: estos nombres de campo son el contrato con los datos que ya
 * viven en el localStorage de los telefonos en uso (clave `svr_state_v1`).
 * Renombrar cualquiera de ellos deja huerfano un reporte a medio levantar en
 * la obra. Si hay que cambiar la forma, se sube la version de la clave y se
 * escribe una migracion en src/storage/migrations.ts.
 */

/** Coordenada del pin sobre un plano, normalizada 0-1 respecto a la lamina. */
export interface PlanPin {
  id: string;
  x: number;
  y: number;
}

export interface ReportItem {
  /** Id local del dispositivo. Es tambien el `client_id` de la fase 1. */
  id: string;
  /**
   * Numero de item. Permanente: borrar el 07 deja hueco, nunca se renumera.
   * `null` solo puede aparecer en datos viejos; se repara al cargar.
   */
  no: number | null;
  /** JPEG en dataURL con las marcas y las redacciones ya aplanadas. */
  src: string;
  /** Miniatura para la tabla resumen del PDF. Ausente en items antiguos. */
  thumb?: string;
  /** Epoch ms. `file.lastModified` de la foto si existe. */
  ts: number;
  zone: string;
  cmt: string;
  plan: PlanPin | null;
}

export interface ReportState {
  proj: string;
  date: string;
  by: string;
  ref: string;
  /** Mientras sea true, `ref` se regenera al cambiar la fecha. */
  refAuto: boolean;
  to: string;
  /** Contador monotono de numeracion de items. Solo sube. */
  seq: number;
  items: ReportItem[];
}

export function emptyReportState(): ReportState {
  return { proj: '', date: '', by: '', ref: '', refAuto: true, to: '', seq: 0, items: [] };
}
