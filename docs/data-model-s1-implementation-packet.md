# S1 implementation packet — foundation (organisation, access, RLS)

**Status: PLANNING ONLY. Nothing was implemented.** No database change, no `pgtap` install, no
application-code change, no commit, no push. Every SQL block below is a **proposal**.

**Date:** 2026-09-04. **Author:** SR DEV.
**Grounded in:** [`data-model-sr-dev-proposal.md`](data-model-sr-dev-proposal.md) rev 8 §4.1, §7,
§16.2; [`data-model-s0a-evidence.md`](data-model-s0a-evidence.md) E-1…E-6, S0b–S0d.

> ## 🚫 S1 is BLOCKED until G-B passes
>
> The Product Owner's ruling makes a successful fresh replay a precondition for **the first S1
> database change and for any S0c/S0d/S1 commit**. G-B has not been run — see §7 for the safest way
> to run it. This packet is what will be executed *after* G-B passes, not before.

---

## 1. Scope — two commits

| Commit | Contents |
|---|---|
| **S1(a)** | Family A tables + explicit `REVOKE` + `ENABLE`/`FORCE` RLS + policies + column grants + `app_private` helpers + indexes + seeds — **one migration, atomically** |
| **S1(b)** | `pgtap` install + the N-1…N-9 harness + consolidation negatives N-P1…N-P8 + the RPC-404 CI test |

Nothing outside Family A. `public.profiles` and `app_private.is_admin` are **retained** in S1 and
removed later in S3 (proposal §7.6.1), so the S2 rollback window keeps working.

---

## 2. S1(a) — proposed migration

Filename when authorised: `supabase/migrations/<ts>_s1a_foundation_org_access_rls.sql`.
This is the **first newly authored migration** in the programme; the four existing files are
reconstructed history (three) and a synthetic baseline (one).

### 2.1 Schemas

```sql
-- app_private already exists (S0a E-5: owner postgres, authenticated has USAGE). Idempotent.
create schema if not exists app_private;
grant usage on schema app_private to authenticated;

-- ref_private is new. No default ACL exists for it, but revoke explicitly rather than assume.
create schema if not exists ref_private;
revoke all on schema ref_private from public, anon, authenticated;
```

### 2.2 Tables

Column conventions per proposal §3.6: every table carries
`id bigint generated always as identity primary key`, `created_at timestamptz not null default now()`,
`created_by bigint not null references app_users(id) on delete restrict` (except `app_users` itself and
the two reference tables), and `content_version integer not null default 1` where mutable.

```sql
create table public.avadhoot_groups (
  id              bigint generated always as identity primary key,
  name            text        not null,
  status          text        not null default 'active',
  content_version integer     not null default 1,
  created_at      timestamptz not null default now(),
  constraint ck_groups_status check (status in ('active','inactive'))
);

create table public.plants (
  id              bigint generated always as identity primary key,
  group_id        bigint      not null,
  plant_code      text        not null,
  name            text        not null,
  timezone        text        not null default 'Asia/Kolkata',
  status          text        not null default 'active',
  content_version integer     not null default 1,
  created_at      timestamptz not null default now(),
  constraint fk_plants_group   foreign key (group_id) references public.avadhoot_groups(id) on delete restrict,
  constraint uk_plants_code    unique (plant_code),
  constraint uk_plants_id_group unique (id, group_id),          -- composite-FK operand
  constraint ck_plants_status  check (status in ('active','inactive'))
);
create index ix_plants_group on public.plants (group_id);

create table public.app_users (
  id              bigint generated always as identity primary key,
  auth_user_id    uuid        null,
  display_name    text        not null,
  status          text        not null default 'invited',
  deactivated_at  timestamptz null,
  content_version integer     not null default 1,
  created_at      timestamptz not null default now(),
  constraint fk_app_users_auth foreign key (auth_user_id) references auth.users(id) on delete restrict,
  constraint uk_app_users_auth unique (auth_user_id),
  constraint ck_app_users_status      check (status in ('invited','active','deactivated')),
  constraint ck_app_users_deactivated check ((status = 'deactivated') = (deactivated_at is not null)),
  constraint ck_app_users_active_has_auth check (status <> 'active' or auth_user_id is not null)
);
create index ix_app_users_auth on public.app_users (auth_user_id);   -- every RLS predicate uses it

create table public.capabilities (
  id              bigint generated always as identity primary key,
  capability_key  text not null,
  scope_kind      text not null,
  description     text not null,
  constraint uk_capabilities_key       unique (capability_key),
  constraint uk_capabilities_key_scope unique (capability_key, scope_kind),
  constraint ck_capabilities_scope     check (scope_kind in ('group','plant'))
);

create table public.group_capability_grants (
  id             bigint generated always as identity primary key,
  app_user_id    bigint      not null,
  capability_id  bigint      not null,
  status         text        not null default 'active',
  granted_at     timestamptz not null default now(),
  granted_by     bigint      not null,
  revoked_at     timestamptz null,
  revoked_by     bigint      null,
  constraint fk_ggrant_user  foreign key (app_user_id)   references public.app_users(id)    on delete restrict,
  constraint fk_ggrant_cap   foreign key (capability_id) references public.capabilities(id) on delete restrict,
  constraint fk_ggrant_by    foreign key (granted_by)    references public.app_users(id)    on delete restrict,
  constraint fk_ggrant_rvby  foreign key (revoked_by)    references public.app_users(id)    on delete restrict,
  constraint ck_ggrant_status  check (status in ('active','revoked')),
  constraint ck_ggrant_revoked check ((status = 'revoked') = (revoked_at is not null))
);
create unique index uk_group_grant_one_active
  on public.group_capability_grants (app_user_id, capability_id) where status = 'active';
create index ix_group_grants_lookup
  on public.group_capability_grants (app_user_id, capability_id) where status = 'active';

create table public.plant_capability_grants (
  id             bigint generated always as identity primary key,
  app_user_id    bigint      not null,
  plant_id       bigint      not null,
  capability_id  bigint      not null,
  status         text        not null default 'active',
  granted_at     timestamptz not null default now(),
  granted_by     bigint      not null,
  revoked_at     timestamptz null,
  revoked_by     bigint      null,
  constraint fk_pgrant_user  foreign key (app_user_id)   references public.app_users(id)    on delete restrict,
  constraint fk_pgrant_plant foreign key (plant_id)      references public.plants(id)       on delete restrict,
  constraint fk_pgrant_cap   foreign key (capability_id) references public.capabilities(id) on delete restrict,
  constraint fk_pgrant_by    foreign key (granted_by)    references public.app_users(id)    on delete restrict,
  constraint fk_pgrant_rvby  foreign key (revoked_by)    references public.app_users(id)    on delete restrict,
  constraint ck_pgrant_status  check (status in ('active','revoked')),
  constraint ck_pgrant_revoked check ((status = 'revoked') = (revoked_at is not null))
);
create unique index uk_plant_grant_one_active
  on public.plant_capability_grants (app_user_id, plant_id, capability_id) where status = 'active';
create index ix_plant_grants_lookup
  on public.plant_capability_grants (app_user_id, plant_id, capability_id) where status = 'active';

create table public.operational_settings (
  id            bigint generated always as identity primary key,
  scope_type    text        not null,
  plant_id      bigint      null,
  setting_key   text        not null,
  setting_value jsonb       not null,
  version_no    integer     not null default 1,
  status        text        not null default 'current',
  created_at    timestamptz not null default now(),
  created_by    bigint      not null,
  constraint fk_opset_plant  foreign key (plant_id)   references public.plants(id)    on delete restrict,
  constraint fk_opset_by     foreign key (created_by) references public.app_users(id) on delete restrict,
  constraint ck_opset_scope         check (scope_type in ('group','plant')),
  constraint ck_opset_plant_present check ((scope_type = 'plant') = (plant_id is not null)),
  constraint ck_opset_status        check (status in ('current','superseded'))
);
create unique index uk_opset_current
  on public.operational_settings (scope_type, coalesce(plant_id, 0), setting_key) where status = 'current';
```

`ref_private.reference_sequences` is created in S1 because P-5 needs it, but **no plant/quote sequence
is consumed until S6**:

```sql
create table ref_private.reference_sequences (
  id          bigint generated always as identity primary key,
  scope_type  text    not null,
  scope_key   bigint  not null,
  fy_label    text    null,
  next_value  bigint  not null default 1,
  constraint ck_refseq_positive check (next_value >= 1),
  constraint uk_refseq unique (scope_type, scope_key, fy_label)
);
revoke all on ref_private.reference_sequences from public, anon, authenticated;
```

### 2.3 Grants — **revocation first, on every table**

S0a **E-5 verified** that Supabase's default ACL grants `anon` and `authenticated` **all privileges**
on new `public` tables. Omitting a revoke on any one table silently exposes its whole write path.

```sql
do $$
declare t text;
begin
  foreach t in array array['avadhoot_groups','plants','app_users','capabilities',
                           'group_capability_grants','plant_capability_grants','operational_settings']
  loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

grant select on public.avadhoot_groups, public.plants, public.capabilities,
                public.operational_settings, public.app_users,
                public.group_capability_grants, public.plant_capability_grants
  to authenticated;

grant insert on public.group_capability_grants, public.plant_capability_grants, public.operational_settings
  to authenticated;
grant update on public.group_capability_grants, public.plant_capability_grants, public.operational_settings
  to authenticated;

-- A-21 / correction 2: the ONLY column a user may self-update.
grant update (display_name) on public.app_users to authenticated;

-- anon receives nothing, anywhere.
```

### 2.4 RLS — enable and **force**, uniformly

```sql
do $$
declare t text;
begin
  foreach t in array array['avadhoot_groups','plants','app_users','capabilities',
                           'group_capability_grants','plant_capability_grants','operational_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
  end loop;
end $$;
```

`ref_private.reference_sequences` gets **no RLS and no policy** — it has no grant, so it is reachable
only through the P-5 definer function.

### 2.5 Helpers — `app_private`, `SECURITY DEFINER`, owned by `postgres`

Recursion terminates because `postgres` holds `BYPASSRLS` (S0a **E-4**, verified), so a helper's read
of the authorisation tables does not re-enter their policies.

```sql
create or replace function app_private.current_app_user()
returns bigint language sql stable security definer set search_path = '' as $$
  select u.id from public.app_users u
   where u.auth_user_id = (select auth.uid()) and u.status = 'active';
$$;

create or replace function app_private.has_group_cap(p_cap text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_capability_grants g
      join public.capabilities c on c.id = g.capability_id
      join public.app_users    u on u.id = g.app_user_id
     where u.auth_user_id = (select auth.uid()) and u.status = 'active'
       and c.capability_key = p_cap and g.status = 'active');
$$;

create or replace function app_private.has_plant_cap(p_plant bigint, p_cap text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.plant_capability_grants g
      join public.capabilities c on c.id = g.capability_id
      join public.app_users    u on u.id = g.app_user_id
     where u.auth_user_id = (select auth.uid()) and u.status = 'active'
       and g.plant_id = p_plant and c.capability_key = p_cap and g.status = 'active');
$$;

create or replace function app_private.is_plant_member(p_plant bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.has_plant_cap(p_plant, 'plant_access');
$$;

-- PUBLIC gets EXECUTE on new functions by built-in default: revoke first, then grant.
do $$
declare f text;
begin
  foreach f in array array['app_private.current_app_user()',
                           'app_private.has_group_cap(text)',
                           'app_private.has_plant_cap(bigint,text)',
                           'app_private.is_plant_member(bigint)']
  loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant  execute on function %s to authenticated', f);
  end loop;
end $$;

-- S1 hardening of the pre-existing helper (proposal §7.6.1). Body already schema-qualifies.
alter function app_private.is_admin(uuid) set search_path = '';
```

### 2.6 Privileged RPCs (P-2, P-3, P-5)

```sql
-- P-2: first sign-in bootstrap. Chicken-and-egg — policies resolve identity THROUGH app_users.
create or replace function app_private.bootstrap_app_user(p_display_name text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select id into v_id from public.app_users where auth_user_id = v_uid;
  if v_id is not null then return v_id; end if;
  -- invitation-only (CDM-05): claim a pre-created invited row, never create one.
  update public.app_users
     set auth_user_id = v_uid, status = 'active', display_name = coalesce(p_display_name, display_name)
   where id = (select id from public.app_users
                where auth_user_id is null and status = 'invited'
                  and lower(display_name) = lower(p_display_name) limit 1)
  returning id into v_id;
  if v_id is null then raise exception 'no pending invitation' using errcode = '42501'; end if;
  return v_id;
end $$;

-- P-3: admin user status change; carries the session-revocation side effect (A-21).
create or replace function app_private.admin_set_user_status(p_user bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.has_group_cap('administer_users') then
    raise exception 'administer_users required' using errcode = '42501';
  end if;
  if p_status not in ('invited','active','deactivated') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  update public.app_users
     set status = p_status,
         deactivated_at = case when p_status = 'deactivated' then now() else null end,
         content_version = content_version + 1
   where id = p_user;
end $$;

-- P-5: reference allocation, in the caller's transaction.
create or replace function ref_private.allocate_reference(
  p_scope_type text, p_scope_key bigint, p_fy text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  if (select app_private.current_app_user()) is null then
    raise exception 'no active app user' using errcode = '42501';
  end if;
  insert into ref_private.reference_sequences (scope_type, scope_key, fy_label, next_value)
  values (p_scope_type, p_scope_key, p_fy, 1)
  on conflict (scope_type, scope_key, fy_label) do nothing;
  update ref_private.reference_sequences
     set next_value = next_value + 1
   where scope_type = p_scope_type and scope_key = p_scope_key
     and fy_label is not distinct from p_fy
  returning next_value - 1 into v;
  return v;
end $$;

do $$
declare f text;
begin
  foreach f in array array['app_private.bootstrap_app_user(text)',
                           'app_private.admin_set_user_status(bigint,text)',
                           'ref_private.allocate_reference(text,bigint,text)']
  loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant  execute on function %s to authenticated', f);
  end loop;
end $$;
```

### 2.7 Policies — **one per table per action** (revision 5 consolidation)

```sql
-- app_users: own row OR administer_users. Column grant already limits UPDATE to display_name.
create policy app_users_select on public.app_users for select to authenticated
  using ( auth_user_id = (select auth.uid())
          or (select app_private.has_group_cap('administer_users')) );
create policy app_users_update_own on public.app_users for update to authenticated
  using      ( auth_user_id = (select auth.uid()) )
  with check ( auth_user_id = (select auth.uid()) );
-- NO insert policy (P-2 only). NO delete policy for any role.

-- vocabulary: readable by any authenticated caller; no commercial content.
create policy groups_select       on public.avadhoot_groups      for select to authenticated using ( true );
create policy plants_select       on public.plants               for select to authenticated using ( true );
create policy capabilities_select on public.capabilities         for select to authenticated using ( true );
create policy opset_select        on public.operational_settings for select to authenticated using ( true );
-- no insert/update/delete policies: all changes are RPC-only.

-- grants: own grants, or administer_users.
create policy ggrant_select on public.group_capability_grants for select to authenticated
  using ( app_user_id = (select app_private.current_app_user())
          or (select app_private.has_group_cap('administer_users')) );
create policy ggrant_insert on public.group_capability_grants for insert to authenticated
  with check ( (select app_private.has_group_cap('administer_users')) );
create policy ggrant_update on public.group_capability_grants for update to authenticated
  using      ( (select app_private.has_group_cap('administer_users')) )
  with check ( (select app_private.has_group_cap('administer_users')) and status = 'revoked' );

create policy pgrant_select on public.plant_capability_grants for select to authenticated
  using ( app_user_id = (select app_private.current_app_user())
          or (select app_private.has_group_cap('administer_users')) );
create policy pgrant_insert on public.plant_capability_grants for insert to authenticated
  with check ( (select app_private.has_group_cap('administer_users')) );
create policy pgrant_update on public.plant_capability_grants for update to authenticated
  using      ( (select app_private.has_group_cap('administer_users')) )
  with check ( (select app_private.has_group_cap('administer_users')) and status = 'revoked' );
```

Every predicate wraps its call as `(select …)` so it becomes a once-per-statement InitPlan — the
remediation advisor lint `0003` names, and which S0a E-6 found the legacy `profiles` policy missing.

Policy count per (table, role, action) is **1** everywhere, so **advisor `0006` is expected to stay at
zero** (proposal §14.2).

### 2.8 Seeds

```sql
insert into public.avadhoot_groups (name) values ('Avadhoot Group');

insert into public.plants (group_id, plant_code, name, timezone)
select g.id, v.code, v.name, 'Asia/Kolkata'
  from public.avadhoot_groups g,
       (values ('NAG','Nagpur'), ('PUN','Pune'), ('KOL','Kolkata')) as v(code, name);

insert into public.capabilities (capability_key, scope_kind, description) values
  ('read_party_master','group','Read Families, Parties, Locations'),
  ('read_construction_library','group','Read Constructions and versions'),
  ('manage_customer_master','group','Write Family/Party/Location'),
  ('manage_construction_library','group','Publish Constructions'),
  ('administer_users','group','Invitation, grants, settings'),
  ('declare_cutover','group','Declare Formal Data Cutover'),
  ('plant_access','plant','Baseline read of a plant''s data'),
  ('make_quote','plant','Maker'),
  ('check_quote','plant','Checker'),
  ('manage_sku_master','plant','SKU publication'),
  ('adopt_construction_for_plant','plant','Adopt a Construction version'),
  ('propose_commercial_master','plant','Propose commercial masters'),
  ('approve_commercial_master','plant','Approve commercial masters');
```

**Plant names** are `Nagpur`, `Pune`, `Kolkata` from `src/data/defaults.js:9`
(`export const PLANTS=["Nagpur","Pune","Kolkata"]`). *The proposal cited `:62` for this; that line is
sector data. Corrected in rev 8.* **Plant codes `NAG`/`PUN`/`KOL` are proposed, not derived** — no
plant code exists in current source, and CDM-37 makes them permanent and never reused, so they need
Product Owner confirmation before this migration is authorised.

`operational_settings` seeds `edit_lock_stale_seconds = 900` (CDM-32) once an admin `app_user` exists;
it carries `created_by`, so it is seeded by the same RPC path that creates the first admin, not inline.

---

## 3. S1(b) — test harness

**`pgtap` is NOT installed** (S0a: available 1.3.3, not installed). Installing it is an S1(b) action
and is **not authorised yet**.

```sql
create extension if not exists pgtap with schema extensions;
```

| Test | Asserts | Source |
|---|---|---|
| N-1 | `authenticated` can execute every helper | §7.3 |
| N-2 | `anon` cannot execute any helper | §7.3 |
| N-3 | plain `select` on `app_users` as an admin returns rows with **no** `infinite recursion detected in policy` | the recursion proof |
| N-4 | `pg_proc.proowner = pg_class.relowner` for helpers vs authorisation tables | §7.3 |
| N-5 | `rolbypassrls` is true for `postgres` | asserts the model's foundation in CI |
| N-6 | every `public` table has `relrowsecurity and relforcerowsecurity` | uniform FORCE |
| N-7 | `anon` holds no privilege on any business table (all four verbs) | E-5 revocation |
| N-8 | `SECURITY DEFINER` inventory equals the reviewed list | §7.6.1 |
| N-9 | a user with zero grants selects zero rows from every business table | CDM-05 |
| **N-10** | `update app_users set status='active'` by its owner fails `42501 permission denied for column status` | A-21 |
| **N-11** | `POST /rest/v1/rpc/has_plant_cap` returns **404** | V-2 regression guard, CI |
| **N-12** | `POST /rest/v1/rpc/is_admin` as authenticated non-Admin and as Admin | **S0a E-2 probes 4–5**, deferred to S1 because they need a test user |

N-P1…N-P8 (consolidation negatives) belong to S3–S5, not S1 — their tables do not exist yet.

---

## 4. Rollback

| | S1(a) | S1(b) |
|---|---|---|
| Compatibility window | all builds — nothing reads the new tables | all builds |
| Forward fix | drop-and-recreate is safe: **zero rows of real data** at this point | drop the extension and the test schema |
| Feature gate | `data_model_v2` stays **off**; no UI path reaches the tables | n/a |
| Data consequence | none | none |
| Reverse migration | `drop schema ref_private cascade; drop table … cascade;` plus dropping the six new `app_private` functions. **`is_admin`'s `search_path` reverts to `public`** | `drop extension pgtap` |

`public.profiles` and `app_private.is_admin` survive S1 untouched apart from the `search_path`
hardening, so the S2 rollback window is unaffected.

---

## 5. Exact commit diff

| Commit | Files |
|---|---|
| **S1(a)** | `quote-gen-be/supabase/migrations/<ts>_s1a_foundation_org_access_rls.sql` **(new)** |
| **S1(b)** | `quote-gen-be/supabase/tests/s1_rls.sql` **(new)**, `quote-gen-be/supabase/migrations/<ts>_s1b_pgtap.sql` **(new)**, one CI workflow file for N-11 **(new)** |

**No application code changes in S1.** No `quote-gen-fe/src` file, no `server.py`, no `vercel.json`.
The four S0c/S0d migration files and the docs are **separate commits** already prepared and likewise
awaiting G-B.

---

## 6. Preconditions before S1(a) may run

| # | Precondition | State |
|---|---|---|
| 1 | **G-B fresh replay passes** | 🚫 **open — blocking** |
| 2 | S0c + S0d commits approved | pending, and themselves blocked by G-B |
| 3 | Plant codes `NAG`/`PUN`/`KOL` confirmed | **needs Product Owner confirmation** — proposed, not derived (CDM-37 makes them permanent) |
| 4 | `pgtap` install authorised | not yet |
| 5 | First admin `app_user` bootstrap route agreed | P-2 claims a pre-created invited row; the very first row has no inviter — needs a one-time seeded invitation |

Items 3 and 5 are narrow and surface here because writing the SQL forced them; they are not new
design questions.

---

## 7. Running G-B — the safest available route

**Requirement:** replay all migrations in timestamp order against an empty database and prove eight
things, **without touching the live project**.

### 7.1 Options compared

| Option | Changes a remote environment? | Cost | Verdict |
|---|---|---|---|
| **A. Local Supabase stack** — `supabase start`, `supabase db reset --local` | **No.** Docker containers on the developer machine; the CLI never contacts the project unless linked | **Free.** Needs Docker Desktop (~1 GB images, one-time) | ✅ **Recommended** |
| B. Throwaway PostgreSQL container — `docker run postgres:15`, apply files with `psql` | No | Free | ⚠️ Fallback. Lacks `auth.users`, so migration 2's FK fails; needs a stub schema, which weakens the proof |
| C. Supabase preview branch (`create_branch`) | **YES** — creates a real branch on the account | **Billed per branch-hour** | ❌ Not recommended; changes a remote environment and costs money |
| D. Second Supabase project | **YES** — new remote project | Free tier possible; counts against project limits | ❌ Heavier than A with no added fidelity |
| E. Restore into the live project | **YES — destructive** | — | ❌ **Never.** Would violate every ruling in this programme |

### 7.2 Recommended — Option A

**Prerequisites:** Docker Desktop for Windows installed and running (**the only new prerequisite**;
verified absent — no `docker`, `podman`, `psql` or local PostgreSQL on this machine). The Supabase CLI
itself needs no install; `npx supabase@latest` works, as used throughout S0c/S0d.

```bash
cd quote-gen-be
npx --yes supabase@latest start                 # boots local Postgres + Auth + PostgREST
npx --yes supabase@latest db reset --local      # drops, recreates, replays ALL migrations in order
```

**Why it does not touch anything remote:** `--local` targets the container stack. No `supabase link`
has been performed, no access token exists (`~/.supabase` absent), and `config.toml` carries
`project_id = "quote-gen-be"` — a local name, not the project ref. The live project is unreachable by
construction, not merely by intent.

**Fidelity:** the local stack includes the real `auth` schema, so migration 2's
`references auth.users(id)` resolves — the reason Option B is inferior.

**Proof queries after reset**, mapping to the eight required items:

```sql
-- 1 all migrations ran, in order
select version, name from supabase_migrations.schema_migrations order by version;
-- 2 no duplicate function / event-trigger conflict  -> reset completes without error
-- 3 ensure_rls exists, enabled, correctly bound
select evtname, evtevent, evtenabled, evtfoid::regproc, array_to_string(evttags,',')
  from pg_event_trigger where evtname = 'ensure_rls';
-- 4 S0b succeeded  +  5 only postgres retains EXECUTE
select coalesce(array_to_string(proacl,' | '),'NULL') from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='rls_auto_enable';        -- expect: postgres=X/postgres
select has_function_privilege(r,'public.rls_auto_enable()','EXECUTE')
  from unnest(array['anon','authenticated','service_role']) r;    -- expect: false, false, false
-- 6 reconstructed profiles / policies / helper state match the pre-S1 baseline
select relrowsecurity, relforcerowsecurity from pg_class where relname='profiles';
select polname, polcmd from pg_policy pol join pg_class c on c.oid=pol.polrelid
 where c.relname='profiles' order by polname;                     -- expect the three legacy policies
select proname, prosecdef, array_to_string(proconfig,',') from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private';
```

**Item 7 — local ⇄ remote alignment** is checked against the *remote* history read-only, exactly as in
S0c/S0d; the replay does not alter it.
**Item 8 — no live state changed** follows structurally: nothing in the sequence addresses the remote
project. Re-running the S0d drift hash against live afterwards would confirm it, and costs one
read-only query.

### 7.3 If Docker cannot be installed

Report it and hold. **Do not** substitute Option B, C or D on my own initiative — that is precisely
the governance deviation ratified-but-not-precedented in S0d §2.3. A blocked authorised mechanism
requires renewed approval before substitution.

---

## 8. Confirmation

- **Nothing implemented.** No database change, no `pgtap` install, no application code, no deployment
  configuration, no commit, no push. S1 not begun.
- The only Supabase access in preparing this packet was **read-only** (`SELECT` on catalogue views).
- All SQL here is a **proposal pending Product Owner approval**, and S1(a) additionally awaits G-B.
