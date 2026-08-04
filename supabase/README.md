# Puesta en marcha del backend

Pasos para dejar la app funcionando contra un proyecto de Supabase nuevo.
Son de una sola vez.

---

## 1. Crear el proyecto

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto.
2. Elige una región cercana a donde se usará la app (la latencia se nota al subir fotos).
3. Guarda la contraseña de la base de datos que te pide: no vuelve a mostrarse.

## 2. Aplicar las migraciones

**Opción A — SQL Editor** (sin instalar nada):

En el panel, `SQL Editor` → `New query`. Pega y ejecuta **en orden**:

1. `migrations/0001_phase1_schema.sql`
2. `migrations/0002_profiles_and_roles.sql`

**Opción B — CLI** (mejor si va a haber más migraciones):

```bash
npx supabase link --project-ref TU-PROJECT-REF
npx supabase db push
```

## 3. Configurar la app

`Project Settings → API`. Copia los dos valores al archivo `.env` de la raíz
del repo (parte de `.env.example`):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

La `anon key` es pública por diseño: viaja en el bundle del navegador y no
concede más permisos de los que dejen pasar las políticas RLS.

**La `service_role` no va nunca en `.env` ni en el navegador.** Salta toda la
seguridad de RLS: quien la tenga lee y escribe cualquier fila de cualquier
empresa. Supabase la inyecta sola en las Edge Functions, que es el único
sitio donde se usa.

## 4. URLs de redirección

`Authentication → URL Configuration`. Son dos ajustes distintos:

- **Site URL** — un solo valor, el destino por defecto. Pon el de producción.
- **Redirect URLs** — una **lista**. Deja los dos, para poder trabajar en local
  y en producción sin tocar nada:

```
http://localhost:5173/aceptar-invitacion
https://TU-DOMINIO/aceptar-invitacion
```

Esta lista es lo que de verdad decide a dónde puede volver un enlace de correo:
Supabase rechaza cualquier destino que no esté aquí.

Ojo: **el login no usa redirecciones**. Solo pasan por aquí los enlaces de
invitación y de recuperación de contraseña.

## 5. Desplegar la Edge Function

Las invitaciones no pueden salir del navegador: crear usuarios exige la
`service_role`.

```bash
npx supabase functions deploy invite-user
```

El enlace del correo vuelve al sitio **desde el que se invitó**: si invitas
desde `localhost:5173` llega a localhost, y si invitas desde producción llega
a producción. No hay nada que cambiar al pasar de uno a otro.

`PUBLIC_APP_URL` es opcional, solo como reserva para llamadas sin cabecera
`Origin` (curl, un cron). Si lo quieres:

```bash
npx supabase secrets set PUBLIC_APP_URL=https://TU-DOMINIO
```

## 6. Crear el primer dueño de la app

Este no lo puede crear nadie desde la aplicación: no hay todavía ningún dueño
que lo invite. Se hace **una vez** a mano.

1. Regístrate por la app (`/registro`) con tu email y confirma el correo.
2. En el `SQL Editor`:

```sql
update profiles set is_app_owner = true where email = 'tu@email.com';
```

3. Recarga la app. Ya verás el panel **Plataforma**.

A partir de ahí todo se hace desde la interfaz: creas empresas, invitas a sus
líderes, y cada líder invita a su propio equipo.

---

## Cómo quedan los permisos

| | Dueño de la app | Líder de empresa | Colaborador |
|---|---|---|---|
| Crear empresas | Sí | No | No |
| Nombrar líderes | Sí | No | No |
| Crear proyectos | Sí | Solo en la suya | No |
| Invitar personas | Sí, cualquier rol | Colaborador y administrador, solo en la suya | No |
| Levantar reportes | Sí | Sí | Sí |
| Ver otras empresas | Sí | No | No |

Esto lo imponen las políticas RLS de la base de datos, no la interfaz. Que un
botón no se pinte no protege nada: cualquiera con la `anon key` puede llamar a
la API directamente. Por eso la Edge Function vuelve a comprobar los permisos
con el JWT de quien llama en vez de fiarse de lo que venga en el cuerpo.

## Comprobación que conviene hacer

Con dos empresas creadas y un colaborador en una de ellas, entra como ese
colaborador y comprueba que `listOrgs()` le devuelve **una sola** empresa.
Si devuelve las dos, hay una policy mal y todo lo demás da igual.
