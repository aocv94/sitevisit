-- =====================================================================
-- Perfiles y roles de plataforma
--
-- La fase 1 modelaba un solo nivel de permiso: eres miembro de una org o
-- no lo eres. Falta el escalon de arriba. Hay tres papeles:
--
--   Dueño de la app   -> crea empresas y da de alta a sus lideres.
--                        Vive POR ENCIMA de las orgs, asi que no se puede
--                        expresar con memberships.role.
--   Lider de empresa  -> memberships.role in ('owner','admin').
--                        Crea proyectos e invita colaboradores, solo dentro
--                        de su empresa.
--   Colaborador       -> memberships.role = 'member'. Levanta reportes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles
--   auth.users no es legible desde el cliente, asi que un lider no podria
--   ni ver el email de su propio equipo. Esta tabla es el espejo legible,
--   y ademas cuelga de ella el rol de plataforma.
-- ---------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text not null,
  full_name    text,
  is_app_owner boolean not null default false,
  -- Fechas derivadas de auth.users al vuelo: permiten al lider distinguir
  -- "invitado, aun no ha entrado" de "activo" sin leer el esquema auth.
  invited_at   timestamptz,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on profiles (email);

-- Alta automatica del perfil. Cubre los dos caminos: registro normal e
-- invitacion (inviteUserByEmail crea la fila de auth.users al instante, sin
-- esperar a que el invitado acepte).
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into profiles (id, email, full_name, invited_at, accepted_at)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.invited_at,
    new.email_confirmed_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- El invitado confirma su email al fijar la contraseña: ese es el momento
-- en que deja de estar pendiente.
create or replace function handle_user_confirmed()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update profiles
     set accepted_at = new.email_confirmed_at,
         email       = new.email
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at, email on auth.users
  for each row when (old.email_confirmed_at is distinct from new.email_confirmed_at
                     or old.email is distinct from new.email)
  execute function handle_user_confirmed();

-- ---------------------------------------------------------------------
-- Helpers de permiso
--   Todos SECURITY DEFINER con search_path fijo, igual que is_member: sin
--   eso un objeto colocado antes en la ruta de resolucion secuestra la
--   funcion. Ser DEFINER es ademas lo que evita la recursion infinita
--   cuando la policy de memberships consulta memberships.
-- ---------------------------------------------------------------------
create or replace function is_app_owner()
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select coalesce((select p.is_app_owner from profiles p where p.id = auth.uid()), false);
$$;

create or replace function is_org_leader(target_org uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.org_id  = target_org
      and m.role in ('owner', 'admin')
  );
$$;

-- Para que un lider vea el perfil de su equipo sin abrir los de otras orgs.
create or replace function shares_org_with(target_user uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1
      from memberships mine
      join memberships theirs on theirs.org_id = mine.org_id
     where mine.user_id = auth.uid()
       and theirs.user_id = target_user
  );
$$;

-- ---------------------------------------------------------------------
-- RLS de profiles
-- ---------------------------------------------------------------------
alter table profiles enable row level security;

create policy profile_read on profiles
  for select using (
    id = auth.uid() or is_app_owner() or shares_org_with(id)
  );

-- Cada quien edita su nombre. Nadie crea ni borra perfiles a mano: de eso
-- se encargan los triggers de auth.users.
create policy profile_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Sin esto, "actualizo mi propio perfil" incluye "me hago dueño de la app".
-- La policy de arriba autoriza la fila entera; el trigger vigila la columna.
create or replace function block_privilege_escalation()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.is_app_owner is distinct from old.is_app_owner and not is_app_owner() then
    raise exception 'Solo el dueño de la app puede cambiar is_app_owner';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_app_owner
  before update on profiles
  for each row execute function block_privilege_escalation();

-- ---------------------------------------------------------------------
-- orgs: el dueño de la app las crea; el lider retoca su branding
--   La policy original solo permitia leer, asi que nadie podia dar de alta
--   una empresa desde la aplicacion.
-- ---------------------------------------------------------------------
drop policy if exists org_read on orgs;

create policy org_read on orgs
  for select using (is_member(id) or is_app_owner());
create policy org_insert on orgs
  for insert with check (is_app_owner());
create policy org_update on orgs
  for update using (is_app_owner() or is_org_leader(id))
  with check (is_app_owner() or is_org_leader(id));
create policy org_delete on orgs
  for delete using (is_app_owner());

-- ---------------------------------------------------------------------
-- memberships: quien pertenece a que empresa y con que papel
--   Antes solo podias ver tu propia fila, asi que un lider no tenia forma
--   de listar su equipo.
-- ---------------------------------------------------------------------
drop policy if exists membership_self on memberships;

create policy membership_read on memberships
  for select using (user_id = auth.uid() or is_org_leader(org_id) or is_app_owner());
create policy membership_insert on memberships
  for insert with check (is_org_leader(org_id) or is_app_owner());
create policy membership_update on memberships
  for update using (is_org_leader(org_id) or is_app_owner())
  with check (is_org_leader(org_id) or is_app_owner());
create policy membership_delete on memberships
  for delete using (is_org_leader(org_id) or is_app_owner());

-- ---------------------------------------------------------------------
-- projects y plans
--   `for all using (is_member(org_id))` daba a CUALQUIER colaborador
--   permiso para crear y borrar proyectos de su empresa. Se parte: leer
--   todos los de la org, escribir solo el lider.
-- ---------------------------------------------------------------------
drop policy if exists project_all on projects;

create policy project_read on projects
  for select using (is_member(org_id) or is_app_owner());
create policy project_insert on projects
  for insert with check (is_org_leader(org_id) or is_app_owner());
create policy project_update on projects
  for update using (is_org_leader(org_id) or is_app_owner())
  with check (is_org_leader(org_id) or is_app_owner());
create policy project_delete on projects
  for delete using (is_org_leader(org_id) or is_app_owner());

drop policy if exists plan_all on plans;

create policy plan_read on plans
  for select using (
    exists (select 1 from projects p where p.id = project_id and (is_member(p.org_id) or is_app_owner()))
  );
create policy plan_write on plans
  for insert with check (
    exists (select 1 from projects p where p.id = project_id and (is_org_leader(p.org_id) or is_app_owner()))
  );
create policy plan_update on plans
  for update using (
    exists (select 1 from projects p where p.id = project_id and (is_org_leader(p.org_id) or is_app_owner()))
  ) with check (
    exists (select 1 from projects p where p.id = project_id and (is_org_leader(p.org_id) or is_app_owner()))
  );
create policy plan_delete on plans
  for delete using (
    exists (select 1 from projects p where p.id = project_id and (is_org_leader(p.org_id) or is_app_owner()))
  );

-- =====================================================================
-- Arranque en frio
--
-- El primer dueño de la app no lo puede crear nadie desde la aplicacion:
-- no hay todavia ningun dueño que lo invite. Se hace UNA vez a mano:
--
--   1. Registrate por la app con tu email.
--   2. En el SQL Editor de Supabase:
--        update profiles set is_app_owner = true where email = 'tu@email.com';
--
-- A partir de ahi ese usuario ya crea empresas e invita lideres.
-- =====================================================================
