-- =====================================================================
-- Arreglo de la recursion entre projects y project_members
--
-- 0005 dejaba subconsultas cruzadas DENTRO de las policies:
--
--   project_read        -> exists (select ... from project_members ...)
--   project_member_read -> exists (select ... from projects ...)
--
-- Una policy se evalua como el usuario que pregunta, o sea CON RLS puesta.
-- Asi que leer projects disparaba la policy de project_members, que volvia
-- a leer projects, y Postgres abortaba con
-- "infinite recursion detected in policy for relation projects".
--
-- La salida es la misma que ya usaba is_member: encerrar la consulta en una
-- funcion SECURITY DEFINER. Al ejecutarse como el dueño de la tabla, RLS no
-- se le aplica y el ciclo se corta.
--
-- Regla practica para este esquema: una policy NO debe consultar otra tabla
-- que tenga RLS. Si necesita hacerlo, va detras de una funcion DEFINER.
-- =====================================================================

/** ¿Le han asignado esta obra a quien pregunta? */
create or replace function is_assigned_to_project(target_project uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from project_members pm
     where pm.project_id = target_project
       and pm.user_id = auth.uid()
  );
$$;

/** ¿Manda quien pregunta en la empresa de esta obra? */
create or replace function is_project_leader(target_project uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from projects p
     where p.id = target_project
       and (is_org_leader(p.org_id) or is_app_owner())
  );
$$;

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------
drop policy if exists project_read on projects;
create policy project_read on projects
  for select using (
    is_org_leader(org_id) or is_app_owner() or is_assigned_to_project(id)
  );

-- ---------------------------------------------------------------------
-- project_members
-- ---------------------------------------------------------------------
drop policy if exists project_member_read on project_members;
drop policy if exists project_member_write on project_members;
drop policy if exists project_member_delete on project_members;

create policy project_member_read on project_members
  for select using (user_id = auth.uid() or is_project_leader(project_id));
create policy project_member_write on project_members
  for insert with check (is_project_leader(project_id));
create policy project_member_delete on project_members
  for delete using (is_project_leader(project_id));

-- ---------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------
drop policy if exists plan_insert on plans;
drop policy if exists plan_update on plans;
drop policy if exists plan_delete on plans;

create policy plan_insert on plans
  for insert with check (is_project_leader(project_id));
create policy plan_update on plans
  for update using (is_project_leader(project_id))
  with check (is_project_leader(project_id));
create policy plan_delete on plans
  for delete using (is_project_leader(project_id));

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
drop policy if exists visit_media_insert on storage.objects;
drop policy if exists visit_media_update on storage.objects;
drop policy if exists visit_media_delete on storage.objects;

create policy visit_media_insert on storage.objects
  for insert with check (
    bucket_id = 'visit-media' and is_project_leader(project_from_path(name))
  );
create policy visit_media_update on storage.objects
  for update using (
    bucket_id = 'visit-media' and is_project_leader(project_from_path(name))
  ) with check (
    bucket_id = 'visit-media' and is_project_leader(project_from_path(name))
  );
create policy visit_media_delete on storage.objects
  for delete using (
    bucket_id = 'visit-media' and is_project_leader(project_from_path(name))
  );
