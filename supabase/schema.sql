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
create or replace function is_member(target_org uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and org_id = target_org
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

create policy report_all on reports
  for all using (is_member(org_id)) with check (is_member(org_id));

create policy item_all on items
  for all using (exists (select 1 from reports r where r.id = report_id and is_member(r.org_id)))
  with check (exists (select 1 from reports r where r.id = report_id and is_member(r.org_id)));

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
