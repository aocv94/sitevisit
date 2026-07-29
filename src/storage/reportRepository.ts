import type { ReportState } from '@/types/report';

/**
 * Puerta de salida de la persistencia.
 *
 * Hoy la unica implementacion es localStorage. La fase 1 (supabase/schema.sql)
 * entra por aqui: una implementacion contra Supabase, o una que envuelva a la
 * local y sincronice, sin tocar componentes ni logica de dominio.
 */
export interface ReportRepository {
  load(): Promise<ReportState | null>;
  /** Lanza StorageFullError si no cabe. */
  save(state: ReportState): Promise<void>;
  /** Bytes ocupados, o null si el backend no sabe medirlo. */
  usageBytes(): number | null;
}

export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super('Storage full - export the PDF now');
    this.name = 'StorageFullError';
    this.cause = cause;
  }
}
