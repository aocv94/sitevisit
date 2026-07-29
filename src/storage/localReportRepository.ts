import type { ReportState } from '@/types/report';
import { StorageFullError, type ReportRepository } from './reportRepository';

/**
 * Clave historica. Cambiarla deja huerfano cualquier reporte a medio levantar
 * que haya en un telefono. Si la forma de ReportState cambia de manera
 * incompatible, sube la version Y escribe la migracion.
 */
export const STORAGE_KEY = 'svr_state_v1';

/** Aviso al usuario a partir de aqui. El limite real ronda los 5-10 MB. */
export const USAGE_WARNING_BYTES = 7 * 1024 * 1024;

/**
 * Persistencia local. Prefiere el puente `window.storage` si el host lo
 * inyecta, con caida a localStorage. Los dos escriben el mismo JSON bajo la
 * misma clave, asi que se pueden alternar sin perder el reporte.
 */
export class LocalReportRepository implements ReportRepository {
  constructor(private readonly key: string = STORAGE_KEY) {}

  async load(): Promise<ReportState | null> {
    const bridge = window.storage;
    if (bridge?.get) {
      try {
        const result = await bridge.get(this.key, false);
        if (result?.value) return JSON.parse(result.value) as ReportState;
      } catch {
        // El puente falla o no esta disponible: seguimos con localStorage.
      }
    }
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as ReportState) : null;
    } catch {
      return null;
    }
  }

  async save(state: ReportState): Promise<void> {
    const serialized = JSON.stringify(state);
    const bridge = window.storage;
    if (bridge?.set) {
      try {
        await bridge.set(this.key, serialized, false);
        return;
      } catch {
        // Igual que en load: caemos a localStorage.
      }
    }
    try {
      localStorage.setItem(this.key, serialized);
    } catch (error) {
      throw new StorageFullError(error);
    }
  }

  usageBytes(): number | null {
    try {
      let total = 0;
      for (const key of Object.keys(localStorage)) {
        total += (localStorage.getItem(key)?.length ?? 0) * 2;
      }
      return total;
    } catch {
      return null;
    }
  }
}
