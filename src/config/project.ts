/**
 * Configuracion por proyecto.
 *
 * Hoy esto es codigo. En la fase 1 (ver supabase/schema.sql) pasa a ser datos:
 * `plans` reemplaza PLANS y `projects.zones` reemplaza ZONES. Por eso ambos se
 * exponen detras de funciones - el resto de la app ya consulta a traves de
 * ellas y no lee las constantes directamente, asi que cambiar la fuente no
 * obliga a tocar los componentes.
 */

export interface PlanDef {
  /** Codigo de lamina, tal y como se guarda en PlanPin.id. */
  id: string;
  /** Como se muestra en los chips y en el PDF. */
  label: string;
  /** Nombre del fichero dentro de public/plans/. */
  file: string;
}

export const PLAN_DIR = 'plans/';

export const PLANS: readonly PlanDef[] = [
  { id: '101', label: '101', file: '101.jpg' },
  { id: '102', label: '102', file: '102.jpg' },
  { id: '103', label: '103', file: '103.jpg' },
  { id: '103a', label: '103A', file: '103a.jpg' },
  { id: '104', label: '104', file: '104.jpg' },
  { id: '105', label: '105', file: '105.jpg' },
  { id: '106', label: '106', file: '106.jpg' },
  { id: '107', label: '107', file: '107.jpg' },
  { id: '108', label: '108', file: '108.jpg' },
  { id: '109', label: '109', file: '109.jpg' },
  { id: '110', label: '110', file: '110.jpg' },
  { id: '111', label: '111', file: '111.jpg' },
  { id: '112', label: '112', file: '112.jpg' },
  { id: '113', label: '113', file: '113.jpg' },
  { id: '114', label: '114', file: '114.jpg' },
];

/**
 * Zonas canonicas por proyecto, indexadas por el nombre en minusculas.
 * Definen tambien el ORDEN en que se agrupan los items en la lista y el PDF.
 * Si el nombre del proyecto no coincide con ninguna clave simplemente no hay
 * chips sugeridos; escribir la zona a mano sigue funcionando.
 */
export const ZONES: Readonly<Record<string, readonly string[]>> = {
  'cora merrick park': [
    'Site / Perimeter',
    'Garage',
    'Lobby',
    'Amenity Deck',
    'Level 02',
    'Level 03',
    'Level 04',
    'Level 05',
    'Level 06',
    'Roof',
    'MEP',
    'Landscape',
  ],
};

export function planById(id: string | null | undefined): PlanDef | null {
  if (!id) return null;
  return PLANS.find((p) => p.id === id) ?? null;
}

export function planLabel(pin: { id: string } | null | undefined): string {
  if (!pin) return '';
  return planById(pin.id)?.label ?? pin.id;
}

export function planUrl(plan: PlanDef): string {
  return `${PLAN_DIR}${plan.file}`;
}

/** Zonas canonicas del proyecto activo. Vacio si el nombre no esta dado de alta. */
export function zonesForProject(projectName: string): readonly string[] {
  return ZONES[projectName.trim().toLowerCase()] ?? [];
}

/** Etiqueta de build, inyectada por Vite. Ver `define` en vite.config.ts. */
export const BUILD: string = __APP_BUILD__;
