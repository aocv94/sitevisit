-- =====================================================================
-- Asignacion por proyecto
--
-- Hasta ahora pertenecer a una empresa daba acceso a TODOS sus proyectos.
-- Con varias obras a la vez eso significa que quien levanta reportes en
-- una ve los planos y las observaciones de las demas.
--
-- A partir de aqui:
--   Lider de empresa -> todos los proyectos de SU empresa, sin asignar
--   Colaborador      -> solo los proyectos donde le hayan puesto
--
-- El lider no se asigna a si mismo: dirige la empresa entera.
-- =====================================================================
create table project_members (
  project_id  uuid not null references projects on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles,
  primary key (project_id, user_id)
);
create index on project_members (user_id);

-- ---------------------------------------------------------------------
-- ¿Puede esta persona trabajar en este proyecto?
--   SECURITY DEFINER, igual que el resto: ademas de fijar el search_path,
--   es lo que evita la recursion cuando la policy de project_members
--   consulta project_members.
-- ---------------------------------------------------------------------
create or replace function can_access_project(target_project uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1
      from projects p
     where p.id = target_project
       and (
         is_app_owner()
         or is_org_leader(p.org_id)
         or exists (
           select 1 from project_members pm
            where pm.project_id = p.id and pm.user_id = auth.uid()
         )
       )
  );
$$;

-- ---------------------------------------------------------------------
-- RLS de project_members
-- ---------------------------------------------------------------------
alter table project_members enable row level security;

create policy project_member_read on project_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from projects p where p.id = project_id
               and (is_org_leader(p.org_id) or is_app_owner()))
  );

-- Asignar es cosa del lider. Un colaborador no se apunta a una obra.
create policy project_member_write on project_members
  for insert with check (
    exists (select 1 from projects p where p.id = project_id
            and (is_org_leader(p.org_id) or is_app_owner()))
  );
create policy project_member_delete on project_members
  for delete using (
    exists (select 1 from projects p where p.id = project_id
            and (is_org_leader(p.org_id) or is_app_owner()))
  );

-- ---------------------------------------------------------------------
-- projects: la lectura se estrecha
--   `is_member(org_id)` daba la lista entera de la empresa a cualquiera.
-- ---------------------------------------------------------------------
drop policy if exists project_read on projects;

create policy project_read on projects
  for select using (
    is_org_leader(org_id) or is_app_owner()
    or exists (select 1 from project_members pm
                where pm.project_id = id and pm.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- plans: se leen los del proyecto al que tienes acceso
-- ---------------------------------------------------------------------
drop policy if exists plan_read on plans;
drop policy if exists plan_write on plans;
drop policy if exists plan_update on plans;
drop policy if exists plan_delete on plans;

create policy plan_read on plans
  for select using (can_access_project(project_id));

create policy plan_insert on plans
  for insert with check (
    exists (select 1 from projects p where p.id = project_id
            and (is_org_leader(p.org_id) or is_app_owner()))
  );
create policy plan_update on plans
  for update using (
    exists (select 1 from projects p where p.id = project_id
            and (is_org_leader(p.org_id) or is_app_owner()))
  ) with check (
    exists (select 1 from projects p where p.id = project_id
            and (is_org_leader(p.org_id) or is_app_owner()))
  );
create policy plan_delete on plans
  for delete using (
    exists (select 1 from projects p where p.id = project_id
            and (is_org_leader(p.org_id) or is_app_owner()))
  );

-- =====================================================================
-- Storage
--
-- La convencion de ruta ya era <org_id>/<project_id>/<archivo>, pero las
-- policies solo miraban la PRIMERA carpeta. Con acceso por proyecto eso
-- deja un agujero: un colaborador de la obra A puede pedir por su ruta
-- directa una lamina de la obra B de la misma empresa.
--
-- Se pasa a resolver tambien la segunda carpeta.
-- =====================================================================
create or replace function project_from_path(object_name text)
returns uuid language plpgsql immutable
set search_path = public, pg_temp as $$
begin
  return ((storage.foldername(object_name))[2])::uuid;
exception when others then
  -- Ruta sin segunda carpeta o con algo que no es un uuid. Devolver null
  -- hace que can_access_project(null) resuelva a false, que es lo seguro.
  return null;
end;
$$;

drop policy if exists visit_media_read on storage.objects;
drop policy if exists visit_media_insert on storage.objects;
drop policy if exists visit_media_update on storage.objects;
drop policy if exists visit_media_delete on storage.objects;

create policy visit_media_read on storage.objects
  for select using (
    bucket_id = 'visit-media' and can_access_project(project_from_path(name))
  );

-- Subir y borrar laminas es del lider. Cuando entren las fotos de los
-- reportes habra que abrir la escritura al colaborador para su propia
-- carpeta; hoy no sube nada.
create policy visit_media_insert on storage.objects
  for insert with check (
    bucket_id = 'visit-media'
    and exists (select 1 from projects p
                 where p.id = project_from_path(name)
                   and (is_org_leader(p.org_id) or is_app_owner()))
  );
create policy visit_media_update on storage.objects
  for update using (
    bucket_id = 'visit-media'
    and exists (select 1 from projects p
                 where p.id = project_from_path(name)
                   and (is_org_leader(p.org_id) or is_app_owner()))
  ) with check (
    bucket_id = 'visit-media'
    and exists (select 1 from projects p
                 where p.id = project_from_path(name)
                   and (is_org_leader(p.org_id) or is_app_owner()))
  );
create policy visit_media_delete on storage.objects
  for delete using (
    bucket_id = 'visit-media'
    and exists (select 1 from projects p
                 where p.id = project_from_path(name)
                   and (is_org_leader(p.org_id) or is_app_owner()))
  );
