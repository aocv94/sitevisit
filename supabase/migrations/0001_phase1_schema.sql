-- =====================================================================
-- Site Visit Report - schema fase 1
-- Multi-tenant desde el dia uno. Todo pasa por org_id + RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------
create table orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,                       -- branding por cliente (hoy hardcodeado a Constellation)
  brand_color text not null default '#7ba7af',
  disclaimer  text,                       -- footer legal, revisable por cada empresa
  created_at  timestamptz not null default now()
);

create table memberships (
  user_id uuid not null references auth.users on delete cascade,
  org_id  uuid not null references orgs      on delete cascade,
  role    text not null default 'member' check (role in ('owner','admin','member')),
  primary key (user_id, org_id)
);

-- ---------------------------------------------------------------------
-- Proyectos y planos
-- ---------------------------------------------------------------------
create table projects (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs on delete cascade,
  name       text not null,
  zones      text[] not null default '{}', -- reemplaza el dict ZONES hardcodeado
  created_at timestamptz not null default now()
);
create index on projects (org_id);

-- reemplaza los 15 JPEG commiteados en plans/
create table plans (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects on delete cascade,
  code         text not null,              -- '101', '103a'
  label        text not null,              -- '101', '103A'
  storage_path text not null,              -- bucket: plans/<org>/<project>/<code>.jpg
  sort         int  not null default 0,
  unique (project_id, code)
);

-- ---------------------------------------------------------------------
-- Reportes
--   draft  -> editable libremente
--   issued -> inmutable; corregir = nueva revision via supersedes_id
-- ---------------------------------------------------------------------
create table reports (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs     on delete cascade,
  project_id      uuid not null references projects on delete cascade,
  ref             text,                    -- SVR-YYYYMMDD-A, null mientras es draft
  status          text not null default 'draft' check (status in ('draft','issued')),
  visit_date      date not null,
  observed_by     text,
  issued_to       text,
  supersedes_id   uuid references reports(id),  -- cadena de revisiones -R1, -R2...
  issued_at       timestamptz,
  issued_snapshot jsonb,                   -- congelado al emitir; el registro legal
  seq             int  not null default 0, -- numeracion permanente de items
  created_by      uuid references auth.users,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint issued_requires_ref check (status = 'draft' or (ref is not null and issued_at is not null))
);
create index on reports (org_id, project_id, visit_date desc);
create unique index on reports (org_id, ref) where ref is not null;

-- ---------------------------------------------------------------------
-- Items
--   'no' es permanente: borrar deja hueco, nunca se renumera
--   client_id hace el sync idempotente (reintento no duplica)
-- ---------------------------------------------------------------------
create table items (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references reports on delete cascade,
  no         int  not null,
  zone       text,
  cmt        text,
  photo_path text,                         -- foto ya marcada y redactada
  thumb_path text,
  plan_id    uuid references plans,
  plan_x     real check (plan_x between 0 and 1),  -- normalizadas, igual que hoy
  plan_y     real check (plan_y between 0 and 1),
  taken_at   timestamptz,
  client_id  text not null,                -- id generado en el dispositivo
  created_at timestamptz not null default now(),
  unique (report_id, no),
  unique (report_id, client_id)
);
create index on items (report_id);

-- =====================================================================
-- RLS - nadie ve nada fuera de su org
-- =====================================================================
-- search_path fijo: sin esto, un SECURITY DEFINER puede ser secuestrado por
-- cualquiera que logre crear un objeto que resuelva antes que memberships.
-- Es el lint function_search_path_mutable de Supabase.
create or replace function is_member(target_org uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and org_id = target_org
  );
$$;

-- Un reporte se ve si eres miembro de su org.
create or replace function report_is_visible(target_report uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from reports r
    where r.id = target_report and is_member(r.org_id)
  );
$$;

-- Se escribe solo mientras sea draft. Emitido = congelado.
create or replace function report_is_writable(target_report uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from reports r
    where r.id = target_report
      and r.status = 'draft'
      and is_member(r.org_id)
  );
$$;

alter table orgs        enable row level security;
alter table memberships enable row level security;
alter table projects    enable row level security;
alter table plans       enable row level security;
alter table reports     enable row level security;
alter table items       enable row level security;

create policy org_read on orgs
  for select using (is_member(id));

create policy membership_self on memberships
  for select using (user_id = auth.uid());

create policy project_all on projects
  for all using (is_member(org_id)) with check (is_member(org_id));

create policy plan_all on plans
  for all using (exists (select 1 from projects p where p.id = project_id and is_member(p.org_id)))
  with check (exists (select 1 from projects p where p.id = project_id and is_member(p.org_id)));

-- 'for all' incluia DELETE, asi que un emitido se podia borrar entero y el
-- trigger de abajo ni se enteraba: solo cubre UPDATE. Se parte la policy.
create policy report_read on reports
  for select using (is_member(org_id));
create policy report_insert on reports
  for insert with check (is_member(org_id));
create policy report_update on reports
  for update using (is_member(org_id)) with check (is_member(org_id));
create policy report_delete on reports
  for delete using (is_member(org_id) and status = 'draft');

-- El trigger protege la fila de reports, no sus items. Sin esto, un reporte
-- emitido conserva su cabecera intacta mientras le vacian el contenido.
create policy item_read on items
  for select using (report_is_visible(report_id));
create policy item_insert on items
  for insert with check (report_is_writable(report_id));
create policy item_update on items
  for update using (report_is_writable(report_id))
  with check (report_is_writable(report_id));
create policy item_delete on items
  for delete using (report_is_writable(report_id));

-- Un reporte emitido no se toca. Las correcciones crean revision nueva.
create or replace function block_issued_edits()
returns trigger language plpgsql as $$
begin
  if old.status = 'issued' then
    raise exception 'Reporte % ya emitido: crear revision con supersedes_id', old.ref;
  end if;
  return new;
end;
$$;

create trigger reports_immutable_when_issued
  before update on reports
  for each row when (old.status = 'issued')
  execute function block_issued_edits();

-- =====================================================================
-- Storage
--   Un bucket privado. Convencion de ruta:  <org_id>/<project_id>/<archivo>
--   Ahi viven tanto los planos (plans.storage_path) como las fotos ya
--   marcadas y redactadas (items.photo_path / thumb_path).
--
--   El control es a nivel de ORG, no de reporte. Un reporte emitido protege
--   sus filas via las policies de arriba, pero su foto en Storage sigue
--   siendo reemplazable por un miembro de la org. Cerrar eso exigiria meter
--   el report_id en la ruta y resolverlo en cada policy; no vale la pena
--   mientras issued_snapshot sea el registro de lo que se emitio.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('visit-media', 'visit-media', false)
on conflict (id) do nothing;

-- La primera carpeta de la ruta es el org_id. Si no es un uuid valido, el
-- cast reventaria dentro de la policy en vez de negar, asi que devuelve null
-- y deja que is_member(null) resuelva a false.
create or replace function org_from_path(object_name text)
returns uuid language plpgsql immutable
set search_path = public, pg_temp as $$
begin
  return ((storage.foldername(object_name))[1])::uuid;
exception when others then
  return null;
end;
$$;

create policy visit_media_read on storage.objects
  for select using (
    bucket_id = 'visit-media' and is_member(org_from_path(name))
  );
create policy visit_media_insert on storage.objects
  for insert with check (
    bucket_id = 'visit-media' and is_member(org_from_path(name))
  );
create policy visit_media_update on storage.objects
  for update using (
    bucket_id = 'visit-media' and is_member(org_from_path(name))
  ) with check (
    bucket_id = 'visit-media' and is_member(org_from_path(name))
  );
create policy visit_media_delete on storage.objects
  for delete using (
    bucket_id = 'visit-media' and is_member(org_from_path(name))
  );
