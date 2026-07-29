/// <reference types="vite/client" />

/** Etiqueta de build inyectada por Vite (`define` en vite.config.ts). */
declare const __APP_BUILD__: string;

/**
 * Puente de almacenamiento opcional que algunos hosts inyectan. Si existe se
 * prefiere sobre localStorage; si no, hay caida automatica. Ver
 * src/storage/localReportRepository.ts.
 */
interface HostStorageBridge {
  get?(key: string, shared: boolean): Promise<{ value?: string } | null>;
  set?(key: string, value: string, shared: boolean): Promise<void>;
}

interface Window {
  storage?: HostStorageBridge;
}
