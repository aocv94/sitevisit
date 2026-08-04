/**
 * Lo poco que sigue siendo configuración de compilación.
 *
 * Aquí vivían PLANS y ZONES: el catálogo de láminas y las zonas canónicas,
 * en el código y por tanto iguales para todas las empresas. Ahora salen de
 * la base de datos —`plans` y `projects.zones`— y llegan a la pantalla de
 * captura por `ProjectProvider`.
 *
 * Cambiar de proyecto ya no es editar este archivo y desplegar: es elegirlo
 * en un desplegable.
 */

/** Etiqueta de build, inyectada por Vite. Ver `define` en vite.config.ts. */
export const BUILD: string = __APP_BUILD__;
