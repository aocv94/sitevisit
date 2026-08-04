# Site Visit Report — Constellation

Aplicación web (PWA) de una sola página para levantar **reportes de visita de obra** en campo:
tomar la foto parado frente al problema, marcarla, escribir la observación, ubicarla en el plano
y exportar un PDF con formato de entrega al contratista.

Está pensada para usarse desde el teléfono, **sin señal**, caminando por la obra.

---

## 1. Qué hace, en orden de uso

1. **Cabecera del reporte** — proyecto, fecha de visita, quién observó, número de reporte
   (`SVR-YYYYMMDD-A`, autogenerado hasta que lo edites a mano) y a quién se emite.
2. **Captura** — “Take photo” abre la cámara trasera; “Add from gallery” permite varias fotos,
   que se procesan una por una. Cada imagen se reescala a máx. 1500 px y se recomprime a JPEG.
3. **Marcado** — sobre la foto puedes:
   - **Circle**: trazo rojo a mano alzada para señalar el problema.
   - **Black out**: rectángulo negro opaco para tapar caras, matrículas o datos sensibles
     (la redacción se quema en el pixel, no es una capa que se pueda quitar después).
   - **Undo / Clear / Rotate**.
4. **Clasificación** — zona (con _chips_ sugeridos según el proyecto) y el texto de la observación,
   que es **obligatorio** para poder guardar.
5. **Pin en plano** — se elige una lámina del set de planos, se hace pinch-zoom y se toca para
   dejar un pin. La coordenada se guarda **normalizada (0–1)**, así que sigue siendo válida
   aunque después se reemplace el JPEG por uno de otra resolución.
6. **Listado** — los ítems se agrupan por zona en el orden canónico del proyecto.
7. **Export PDF / Share** — genera el documento y lo descarga, o lo pasa a la hoja de compartir
   nativa del teléfono (`navigator.share`) para mandarlo por correo/WhatsApp sin salir de la app.

### El PDF que produce

- **Portada + tabla resumen**: una fila por ítem con número, miniatura y texto, con bandas
  de zona como separadores.
- **Fichas de detalle**: dos ítems por página, cada uno con la foto marcada a tamaño grande y,
  si tiene pin, un **key plan** al costado — el plano recortado con el pin numerado encima.
- **Pie legal en todas las páginas**: deja constancia de que es una visita general, no una
  inspección exhaustiva, y que ni incluir ni omitir un ítem implica aprobación o rechazo de
  la obra. Es la razón por la que este PDF se puede mandar sin abrir una discusión contractual.

---

## 2. Stack

React 19 + TypeScript + Vite, con `vite-plugin-pwa` para el service worker.
Backend en Supabase: autenticación, empresas, proyectos y permisos.

```bash
npm install
cp .env.example .env   # y rellena las dos claves de Supabase
npm run dev            # servidor de desarrollo en http://localhost:5173
npm run build          # typecheck + bundle de produccion en dist/
npm run check          # typecheck + lint + tests
```

Sin `.env` la app arranca igual y enseña una pantalla explicando qué falta.
La puesta en marcha del backend está en [`supabase/README.md`](supabase/README.md):
crear el proyecto, aplicar migraciones, desplegar la Edge Function y crear el
primer dueño de la app.

| Script                          | Qué hace                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `dev`                           | Vite en modo desarrollo con HMR.                                                    |
| `build`                         | `tsc --build` y luego `vite build`. El typecheck bloquea el build.                  |
| `preview`                       | Sirve `dist/` para probar el bundle real (necesario para probar el service worker). |
| `typecheck` / `lint` / `format` | Por separado.                                                                       |
| `test` / `test:watch`           | Vitest sobre la lógica pura.                                                        |
| `check`                         | Los tres anteriores. Lo que conviene correr antes de un commit.                     |

### Quién puede hacer qué

|                                  | Dueño de la app | Líder de empresa                        | Colaborador |
| -------------------------------- | --------------- | --------------------------------------- | ----------- |
| Crear empresas y nombrar líderes | Sí              | No                                      | No          |
| Crear proyectos                  | Sí              | Solo en la suya                         | No          |
| Invitar personas                 | Cualquier rol   | Colaborador y administrador, en la suya | No          |
| Levantar reportes                | Sí              | Sí                                      | Sí          |
| Ver otras empresas               | Sí              | No                                      | No          |

Lo imponen las políticas RLS de la base de datos, no la interfaz: las guardas
de React son comodidad de navegación, no seguridad. Cualquiera con la `anon key`
puede llamar a la API sin pasar por la pantalla.

---

## 3. Estructura

```
src/
├── main.tsx                  arranque: router + sesion + registro del service worker
├── AppRoutes.tsx             rutas y a donde aterriza cada rol al entrar
├── sw.ts                     service worker (politica de caché offline)
├── auth/                     AuthProvider (sesion, perfil, membresias) y guardas
├── api/                      consultas a Supabase: orgs, projects, members
├── lib/supabase.ts           cliente; sin claves no revienta, avisa
├── routes/
│   ├── LoginPage / SignUpPage / ForgotPasswordPage / AcceptInvitePage
│   ├── OwnerDashboard.tsx    empresas y lideres (dueño de la app)
│   ├── LeaderDashboard.tsx   proyectos y equipo (lider de empresa)
│   └── CapturePage.tsx       la pantalla de campo
├── config/project.ts         PLANS, ZONES y BUILD — la configuracion por proyecto
├── types/                    report.ts (contrato con localStorage), db.ts, markup.ts
├── lib/                      logica pura, sin React
│   ├── report.ts             numeracion, orden por zona, autoRef, nombre de fichero
│   ├── image.ts              reescalado, rotacion, miniatura, aplanado de marcas
│   ├── marks.ts              pintado de trazos y redacciones
│   └── plan.ts               transformadas del pin, pinch-zoom, key plan, cache de laminas
├── storage/                  ReportRepository (interfaz) + implementacion localStorage
├── state/                    ReportProvider: estado del reporte, persistencia, mensajes
├── pdf/                      renderReport.ts (jsPDF), theme.ts (retícula y color), logo.ts
├── hooks/                    usePdfExport, useAsyncData, useConnectivityFlash
├── components/               un componente por bloque de UI
└── styles/                   tokens.css (color) + app.css (captura) + admin.css (paneles)

public/
└── icon-192.png, icon-512.png

supabase/
├── README.md                 puesta en marcha del backend
├── migrations/               esquema y politicas RLS
└── functions/invite-user/    alta de usuarios (necesita service_role: Deno, no navegador)
```

**La regla que ordena todo esto**: `lib/` no importa React ni toca el DOM salvo canvas, y
`components/` no contiene lógica de dominio. Por eso la lógica que importa (numeración,
orden, transformadas del pin) se puede testear sin montar un navegador.

---

## 4. Configuración por proyecto

Todo vive en [`src/config/project.ts`](src/config/project.ts):

1. **`PLANS`** — el catálogo de láminas `{id, label, file}`.
2. **`ZONES`** — zonas canónicas **indexadas por el nombre del proyecto en minúsculas**.
   Definen también el orden de agrupación en la lista y en el PDF. Hoy solo existe
   `'cora merrick park'`; si el campo _Project_ no coincide con ninguna clave, simplemente no
   hay chips sugeridos y las zonas escritas a mano siguen funcionando.
3. **Los JPEG en `public/plans/`** — deben coincidir con los nombres declarados en `PLANS`.

El resto de la app consulta a través de `planById()`, `planLabel()` y `zonesForProject()`, no
lee las constantes directamente. Cuando la fase 1 mueva esto a base de datos, solo cambia este
archivo.

**`BUILD`** ya no se edita a mano: lo inyecta Vite desde la versión de `package.json` y la fecha
de compilación, y se muestra bajo el título para poder confirmar en obra qué versión trae el
teléfono.

---

## 5. Offline y despliegue

[`src/sw.ts`](src/sw.ts) implementa dos políticas deliberadamente distintas:

- **Navegación → network-first con timeout de 2.5 s.** Se intenta la red para recoger el
  último deploy, pero se abandona rápido y se sirve la caché. _Un sótano con una barra de
  señal es peor que ninguna barra_: sin el timeout la app se queda esperando.
- **Todo lo demás → cache-first.** La app abre instantánea y sin conexión.

Los assets con hash, los planos y los iconos entran al precache desde el manifiesto que inyecta
Vite. **Ya no hay que mantener la lista de planos a mano en dos sitios**: basta con dejar el
JPEG en `public/plans/`.

La otra mitad de la política son las cabeceras HTTP de [`vercel.json`](vercel.json), y las dos
se leen juntas:

- `/sw.js` y `/index.html` → `max-age=0, must-revalidate`. **El service worker es el único
  mecanismo por el que un deploy nuevo llega a un teléfono que ya tiene la PWA instalada.**
  Si se cachea, te quedas clavado en la versión vieja.
- `/plans/*` → también revalida, porque los planos se reemplazan **con el mismo nombre de
  archivo** (`101.jpg` sigue llamándose `101.jpg`).
- `/assets/*` e iconos → un año, `immutable`. Vite les pone hash en el nombre, así que un
  cambio de contenido es un cambio de URL.

El service worker se compila como **worker clásico (iife)**, no como módulo ES: los service
workers de tipo módulo no llegan a todos los Safari de iOS, y sin worker no hay modo offline.

**Despliegue:** sitio estático en Vercel, `npm run build` → `dist/`. Cualquier hosting estático
sirve igual, pero replicar esas cabeceras no es opcional.

---

## 6. Decisiones que conviene no romper

- **Los números de ítem son permanentes.** `state.seq` solo sube. Borrar el ítem 07 deja un
  hueco; nunca se renumera. Es intencional: el PDF ya emitido y la conversación con el
  contratista se refieren a “el ítem 07”, y ese número no puede pasar a significar otra cosa.
  Está cubierto por tests en [`src/lib/report.test.ts`](src/lib/report.test.ts).
- **La clave `svr_state_v1` de `localStorage` y la forma de `ReportState` son un contrato**
  con los datos que ya viven en los teléfonos. Renombrar un campo deja huérfano un reporte a
  medio levantar en la obra. Si hay que cambiar la forma: sube la versión de la clave y escribe
  la migración.
- **Los pines se guardan normalizados (0–1)**, no en píxeles.
- **Rotar siempre parte de la imagen original sin rotar**, aplicando el ángulo acumulado.
  Rotar sobre lo ya rotado recomprime el JPEG en cada vuelta. Como las marcas están atadas a la
  orientación anterior, al rotar **se borran** y la app lo avisa, en vez de repintarlas torcidas.
- **La redacción es destructiva por diseño.** Al guardar, marcas y rectángulos negros se
  aplanan sobre el JPEG. No existe forma de recuperar lo tapado, que es justo lo que se quiere.
- **jsPDF se carga con `import()` dinámico.** Pesa más que el resto de la app junta y solo hace
  falta al exportar; así el arranque en campo es ligero. Sigue estando precacheado, así que el
  primer export offline funciona.
- **Las marcas y el encuadre del plano viven en `useRef`, no en estado de React.** Se
  actualizan a ritmo de dedo y pasar cada punto por `setState` tiraría el frame rate.
- **El pin se confirma al levantar el dedo, no al tocar.** Mientras el gesto sigue vivo no se
  sabe si es un toque o el principio de un pinch; si llega un segundo dedo, el pin candidato se
  descarta. Sin esto, cada intento de hacer zoom dejaba un pin suelto en el plano.

---

## 7. Estado actual y hacia dónde va

**Hoy:** app local, un dispositivo, un reporte a la vez, sin cuentas, sin backend, sin
sincronización. Todo vive en `localStorage` (fotos en base64 incluidas). El PDF es el único
entregable y el único respaldo.

**Fase 1 (diseñada, no implementada):** [`supabase/schema.sql`](supabase/schema.sql) ya define
el backend, pero **ninguna línea de `src/` lo usa todavía**. Aplicarlo no cambia nada en la app
actual. Lo que plantea:

- **Multi-tenant desde el día uno**: `orgs` + `memberships`, con RLS en todas las tablas.
  El branding (logo, color, disclaimer) pasa a ser por organización en vez de estar
  hardcodeado a Constellation.
- **`projects.zones`** reemplaza `ZONES` y la tabla **`plans`** reemplaza los JPEG del repo.
- **Reportes con estado `draft` → `issued`.** Un reporte emitido queda **congelado**: lo protege
  un trigger, políticas RLS separadas por operación y un `issued_snapshot` en JSONB que es el
  registro legal de lo que se emitió. Corregir no es editar: se crea una revisión nueva
  encadenada por `supersedes_id`.
- **`items.client_id`** hace la sincronización idempotente — reintentar no duplica. Ya existe
  en el cliente: es el `id` de `ReportItem`.
- **Storage privado** en el bucket `visit-media`, con ruta `<org_id>/<project_id>/<archivo>`.

**Por dónde entra:** la interfaz [`ReportRepository`](src/storage/reportRepository.ts). Una
implementación contra Supabase (o una que envuelva a la local y sincronice) se inyecta en
`main.tsx` sin tocar componentes ni lógica de dominio. Los tokens de color de
[`tokens.css`](src/styles/tokens.css) están aislados por la misma razón: el branding por
organización se resuelve sobrescribiendo variables en `:root`.

---

## 8. Limitaciones conocidas

- **Un solo reporte a la vez.** No hay historial: “Clear” borra todo y empieza de cero.
- **Techo de `localStorage`** (~5–10 MB según el navegador). El aviso salta a los 7 MB, pero
  no hay purga automática ni evicción por antigüedad.
- **Sin autenticación ni control de acceso.** Quien tenga el teléfono desbloqueado tiene el
  reporte.
- **`navigator.share` con archivos** no existe en todos los navegadores; hay caída automática
  a descarga directa.
- **La miniatura de la tabla resumen recorta al centro.** Una foto apaisada pierde los
  laterales en esa columna. Es preferible al estirado, que la achataba y la hacía difícil de
  reconocer, y la foto completa sigue en la ficha de detalle — pero si lo importante de un ítem
  queda en un borde, ahí no se verá.
- La fuente se carga desde Google Fonts, así que **la primera visita sin conexión** cae a la
  tipografía del sistema hasta que la fuente quede en caché.
