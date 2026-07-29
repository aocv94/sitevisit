import { createContext, useContext } from 'react';
import type { ReportItem, ReportState } from '@/types/report';

export type HeaderPatch = Partial<Pick<ReportState, 'proj' | 'date' | 'by' | 'ref' | 'to'>>;

export interface ReportStore {
  state: ReportState;
  /** false hasta que termina la carga inicial desde el repositorio. */
  ready: boolean;
  /** Mensaje efimero de la barra de estado. */
  status: string;
  flash(message: string): void;
  updateHeader(patch: HeaderPatch): void;
  /** Alta o edicion. En el alta asigna el siguiente numero permanente. */
  saveItem(item: ReportItem): void;
  removeItem(id: string): void;
  clearItems(): void;
}

export const ReportContext = createContext<ReportStore | null>(null);

export function useReport(): ReportStore {
  const store = useContext(ReportContext);
  if (!store) throw new Error('useReport debe usarse dentro de <ReportProvider>');
  return store;
}
