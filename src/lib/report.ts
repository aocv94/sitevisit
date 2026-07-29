import type { ReportItem, ReportState } from '@/types/report';

export const UNASSIGNED_ZONE = 'Unassigned';

/** Fecha de hoy en horario local como YYYY-MM-DD (no UTC: la visita es local). */
export function todayLocal(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Numero de reporte por defecto: SVR-YYYYMMDD-A. */
export function autoRef(dateStr?: string): string {
  return `SVR-${String(dateStr || todayLocal()).replace(/-/g, '')}-A`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Numero de item con dos digitos para la lista. `?` si falta. */
export function formatItemNo(item: ReportItem): string {
  return String(item.no == null ? '?' : item.no).padStart(2, '0');
}

export function itemZone(item: ReportItem): string {
  return item.zone || UNASSIGNED_ZONE;
}

/**
 * Items agrupados por zona: primero las zonas canonicas del proyecto en su
 * orden, despues las escritas a mano en el orden en que aparecieron.
 */
export function orderItems(
  items: readonly ReportItem[],
  canonicalZones: readonly string[]
): ReportItem[] {
  const zones = [...canonicalZones];
  for (const item of items) {
    const zone = itemZone(item);
    if (!zones.includes(zone)) zones.push(zone);
  }
  return zones.flatMap((zone) => items.filter((item) => itemZone(item) === zone));
}

/**
 * Repara la numeracion al cargar: respeta los numeros existentes, asigna los
 * que falten y deja `seq` por encima del mayor. Nunca reutiliza un numero
 * retirado, que es la razon de ser de `seq`.
 */
export function reconcileItemNumbers(state: ReportState): ReportState {
  let maxNo = state.seq || 0;
  for (const item of state.items) {
    if (typeof item.no === 'number' && item.no > maxNo) maxNo = item.no;
  }
  const items = state.items.map((item) => {
    if (typeof item.no === 'number') return item;
    maxNo += 1;
    return { ...item, no: maxNo };
  });
  return { ...state, items, seq: maxNo };
}

/** Nombre del PDF exportado. Se sanea porque acaba en un sistema de ficheros. */
export function buildFilename(state: ReportState): string {
  const safe = (value: string) => value.replace(/[^a-z0-9]/gi, '_');
  const proj = safe(state.proj || 'SiteVisit');
  const ref = safe(state.ref || 'SVR');
  const date = state.date || todayLocal();
  return `${proj}_${ref}_${date}.pdf`;
}

/** Ids de plano referenciados por al menos un item, sin repetir. */
export function referencedPlanIds(items: readonly ReportItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.plan && !ids.includes(item.plan.id)) ids.push(item.plan.id);
  }
  return ids;
}

export function createItemId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
