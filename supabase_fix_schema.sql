-- Combined schema for project vofjektddsxmavghlerj
-- Generated from supabase/migrations (ordered).

-- Pre-existing `profiles` (created outside this file) may be missing columns
-- that later INSERTs expect. Skip entirely when the table does not exist yet.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS boat_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'tr';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marina text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_picture_url text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_health_note text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_location text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_marina text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance numeric NOT NULL DEFAULT 0;
END $$;


-- ===== 20260701230657_896db2d8-a977-4293-ba9c-3ab8206b7779.sql =====

-- =========================================
-- ENUMS
-- =========================================
DO $$ BEGIN
  create type public.app_role as enum ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.user_role as enum ('Client', 'Provider');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.service_type as enum ('Marine Mechanic', 'Underwater Diver');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.provider_status as enum ('Available', 'Busy', 'Offline');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.job_status as enum ('Pending','Offered','Accepted','EnRoute','OnSite','PartsPending','InProgress','Completed','Cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.part_status as enum ('Pending','Paid','Rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.language_code as enum ('tr','en');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  boat_name text,
  phone text,
  role public.user_role not null default 'Client',
  wallet_balance numeric not null default 0,
  preferred_language public.language_code not null default 'tr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
DROP POLICY IF EXISTS "Profiles: read all authed" ON public.profiles;
create policy "Profiles: read all authed" on public.profiles for select to authenticated using (true);
DROP POLICY IF EXISTS "Profiles: insert self" ON public.profiles;
create policy "Profiles: insert self"   on public.profiles for insert to authenticated with check (auth.uid() = id);
DROP POLICY IF EXISTS "Profiles: update self" ON public.profiles;
create policy "Profiles: update self"   on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- =========================================
-- USER ROLES (admin flag)
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
DROP POLICY IF EXISTS "user_roles: read self" ON public.user_roles;
create policy "user_roles: read self" on public.user_roles for select to authenticated using (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  );
$$;

-- =========================================
-- PROVIDER DETAILS
-- =========================================
CREATE TABLE IF NOT EXISTS public.provider_details (
  id uuid primary key references public.profiles(id) on delete cascade,
  service_type public.service_type not null,
  specialized_brands text[] not null default '{}',
  certification_url text,
  live_status public.provider_status not null default 'Available',
  rating numeric not null default 5,
  jobs_completed integer not null default 0,
  marina text not null default 'Göcek',
  lat numeric not null default 0.5,
  lng numeric not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.provider_details to authenticated;
grant all on public.provider_details to service_role;
alter table public.provider_details enable row level security;
DROP POLICY IF EXISTS "providers: readable by all authed" ON public.provider_details;
create policy "providers: readable by all authed" on public.provider_details for select to authenticated using (true);
DROP POLICY IF EXISTS "providers: manage own" ON public.provider_details;
create policy "providers: manage own" on public.provider_details for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- =========================================
-- JOBS
-- =========================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid references public.profiles(id) on delete set null,
  service_type public.service_type not null,
  problem_category text not null,
  description text not null default '',
  photo_url text,
  lat numeric not null default 0.5,
  lng numeric not null default 0.5,
  marina text not null default 'Göcek',
  status public.job_status not null default 'Pending',
  initial_labor_cost numeric not null default 0,
  extra_parts_cost numeric not null default 0,
  total_escrow_pool numeric not null default 0,
  dispatched_at timestamptz,
  eta_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
-- Client sees own jobs; provider sees jobs assigned or open in their category
DROP POLICY IF EXISTS "jobs: client reads own" ON public.jobs;
create policy "jobs: client reads own" on public.jobs for select to authenticated using (client_id = auth.uid());
DROP POLICY IF EXISTS "jobs: provider reads assigned" ON public.jobs;
create policy "jobs: provider reads assigned" on public.jobs for select to authenticated using (provider_id = auth.uid());
DROP POLICY IF EXISTS "jobs: providers read open pool" ON public.jobs;
create policy "jobs: providers read open pool" on public.jobs
  for select to authenticated
  using (
    status = 'Pending'
    and exists (
      select 1 from public.provider_details pd
      where pd.id = auth.uid() and pd.service_type = jobs.service_type
    )
  );
DROP POLICY IF EXISTS "jobs: client inserts" ON public.jobs;
create policy "jobs: client inserts" on public.jobs for insert to authenticated
  with check (client_id = auth.uid());
DROP POLICY IF EXISTS "jobs: client or provider update" ON public.jobs;
create policy "jobs: client or provider update" on public.jobs for update to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid())
  with check (client_id = auth.uid() or provider_id = auth.uid());

-- =========================================
-- JOB OFFERS
-- =========================================
CREATE TABLE IF NOT EXISTS public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  price numeric not null,
  eta_minutes integer not null,
  note text,
  created_at timestamptz not null default now(),
  unique(job_id, provider_id)
);
grant select, insert, delete on public.job_offers to authenticated;
grant all on public.job_offers to service_role;
alter table public.job_offers enable row level security;
DROP POLICY IF EXISTS "offers: participants read" ON public.job_offers;
create policy "offers: participants read" on public.job_offers for select to authenticated
  using (
    provider_id = auth.uid()
    or exists (select 1 from public.jobs j where j.id = job_id and j.client_id = auth.uid())
  );
DROP POLICY IF EXISTS "offers: provider inserts own" ON public.job_offers;
create policy "offers: provider inserts own" on public.job_offers for insert to authenticated
  with check (
    provider_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      join public.provider_details pd on pd.id = auth.uid()
      where j.id = job_id and j.status = 'Pending' and j.service_type = pd.service_type
    )
  );

-- =========================================
-- JOB PARTS
-- =========================================
CREATE TABLE IF NOT EXISTS public.job_parts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  part_name text not null,
  part_price numeric not null,
  part_image_url text,
  source text not null default 'Tedarikçi Firma (Local Supplier)',
  payment_status public.part_status not null default 'Pending',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.job_parts to authenticated;
grant all on public.job_parts to service_role;
alter table public.job_parts enable row level security;
DROP POLICY IF EXISTS "parts: participants read" ON public.job_parts;
create policy "parts: participants read" on public.job_parts for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));
DROP POLICY IF EXISTS "parts: provider inserts" ON public.job_parts;
create policy "parts: provider inserts" on public.job_parts for insert to authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.provider_id = auth.uid()));
DROP POLICY IF EXISTS "parts: participants update" ON public.job_parts;
create policy "parts: participants update" on public.job_parts for update to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));

-- =========================================
-- CHAT
-- =========================================
CREATE TABLE IF NOT EXISTS public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  masked boolean not null default false,
  blocked_terms text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert on public.job_messages to authenticated;
grant all on public.job_messages to service_role;
alter table public.job_messages enable row level security;
DROP POLICY IF EXISTS "msgs: participants read" ON public.job_messages;
create policy "msgs: participants read" on public.job_messages for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));
DROP POLICY IF EXISTS "msgs: participants insert" ON public.job_messages;
create policy "msgs: participants insert" on public.job_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid()))
  );

-- =========================================
-- PLATFORM LEDGER
-- =========================================
CREATE TABLE IF NOT EXISTS public.platform_ledger (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  commission_amount numeric not null,
  provider_payout numeric not null,
  created_at timestamptz not null default now()
);
grant select on public.platform_ledger to authenticated;
grant all on public.platform_ledger to service_role;
alter table public.platform_ledger enable row level security;
DROP POLICY IF EXISTS "ledger: admins read" ON public.platform_ledger;
create policy "ledger: admins read" on public.platform_ledger for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- TRIGGERS
-- =========================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger t_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger t_providers_updated before update on public.provider_details for each row execute function public.set_updated_at();
create trigger t_jobs_updated before update on public.jobs for each row execute function public.set_updated_at();

-- Auto-create profile on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, boat_name, role, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'boat_name',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'Client'),
    coalesce((new.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================
-- RPCs (SECURITY DEFINER)
-- =========================================
create or replace function public.accept_offer(_job_id uuid, _offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.job_offers%rowtype;
begin
  select * into o from public.job_offers where id = _offer_id and job_id = _job_id;
  if not found then raise exception 'Offer not found'; end if;
  update public.jobs
    set provider_id = o.provider_id,
        initial_labor_cost = o.price,
        total_escrow_pool = o.price,
        eta_minutes = o.eta_minutes,
        status = 'Accepted'
    where id = _job_id and client_id = auth.uid();
  if not found then raise exception 'Not authorized'; end if;
end $$;

create or replace function public.set_sail(_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.jobs set status='EnRoute', dispatched_at = now()
    where id=_job_id and provider_id = auth.uid();
end $$;

create or replace function public.mark_arrived(_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.jobs set status='OnSite' where id=_job_id and provider_id = auth.uid();
end $$;

create or replace function public.add_extra_part(_job_id uuid, _name text, _price numeric, _photo text, _source text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if not exists (select 1 from public.jobs where id=_job_id and provider_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  insert into public.job_parts(job_id, part_name, part_price, part_image_url, source)
    values (_job_id, _name, _price, _photo, coalesce(_source,'Tedarikçi Firma (Local Supplier)'))
    returning id into _id;
  update public.jobs set status='PartsPending' where id=_job_id;
  return _id;
end $$;

create or replace function public.approve_part(_part_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.job_parts%rowtype;
begin
  select * into p from public.job_parts where id=_part_id;
  if not found then raise exception 'Part not found'; end if;
  if not exists (select 1 from public.jobs where id=p.job_id and client_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.job_parts set payment_status='Paid' where id=_part_id;
  update public.jobs
    set extra_parts_cost = extra_parts_cost + p.part_price,
        total_escrow_pool = total_escrow_pool + p.part_price,
        status = case when exists(select 1 from public.job_parts where job_id=p.job_id and payment_status='Pending')
                      then 'PartsPending' else 'InProgress' end
    where id=p.job_id;
end $$;

create or replace function public.reject_part(_part_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.job_parts%rowtype;
begin
  select * into p from public.job_parts where id=_part_id;
  if not exists (select 1 from public.jobs where id=p.job_id and client_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.job_parts set payment_status='Rejected' where id=_part_id;
  update public.jobs
    set status = case when exists(select 1 from public.job_parts where job_id=p.job_id and payment_status='Pending')
                      then 'PartsPending' else 'InProgress' end
    where id=p.job_id;
end $$;

create or replace function public.complete_job(_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare total numeric; commission numeric; payout numeric; prov uuid;
begin
  select total_escrow_pool, provider_id into total, prov from public.jobs
    where id=_job_id and client_id=auth.uid();
  if not found then raise exception 'Not authorized'; end if;
  commission := round(total * 0.10);
  payout := total - commission;
  update public.jobs set status='Completed' where id=_job_id;
  update public.profiles set wallet_balance = wallet_balance + payout where id = prov;
  insert into public.platform_ledger(job_id, commission_amount, provider_payout)
    values (_job_id, commission, payout);
end $$;

-- =========================================
-- REALTIME
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'job_offers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_offers;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'job_parts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_parts;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'job_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_messages;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'provider_details'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_details;
  END IF;
END $$;


-- ===== 20260701230719_822c7611-f656-4e75-9d7e-40a1b661209b.sql =====

-- Lock down SECURITY DEFINER RPCs to authenticated users only
revoke execute on function public.accept_offer(uuid,uuid) from public, anon;
revoke execute on function public.set_sail(uuid) from public, anon;
revoke execute on function public.mark_arrived(uuid) from public, anon;
revoke execute on function public.add_extra_part(uuid,text,numeric,text,text) from public, anon;
revoke execute on function public.approve_part(uuid) from public, anon;
revoke execute on function public.reject_part(uuid) from public, anon;
revoke execute on function public.complete_job(uuid) from public, anon;
revoke execute on function public.has_role(uuid, text) from public, anon;
grant execute on function public.accept_offer(uuid,uuid) to authenticated;
grant execute on function public.set_sail(uuid) to authenticated;
grant execute on function public.mark_arrived(uuid) to authenticated;
grant execute on function public.add_extra_part(uuid,text,numeric,text,text) to authenticated;
grant execute on function public.approve_part(uuid) to authenticated;
grant execute on function public.reject_part(uuid) to authenticated;
grant execute on function public.complete_job(uuid) to authenticated;
grant execute on function public.has_role(uuid, text) to authenticated;

-- Pin search_path on the utility triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;


-- ===== 20260701232600_071b5a02-fd88-4739-85d0-fafd4b8ea569.sql =====

-- 1. Profiles SELECT hardening
DROP POLICY IF EXISTS "Profiles: read all authed" ON public.profiles;

DROP POLICY IF EXISTS "Profiles: read own" ON public.profiles;
CREATE POLICY "Profiles: read own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: admins read all" ON public.profiles;
CREATE POLICY "Profiles: admins read all"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Job participants can read each other's basic profile row (needed for names shown in job/offer UIs)
DROP POLICY IF EXISTS "Profiles: job participants read" ON public.profiles;
CREATE POLICY "Profiles: job participants read"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE (j.client_id = auth.uid() AND j.provider_id = profiles.id)
       OR (j.provider_id = auth.uid() AND j.client_id = profiles.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.job_offers o
    JOIN public.jobs j ON j.id = o.job_id
    WHERE o.provider_id = profiles.id AND j.client_id = auth.uid()
  )
);

-- 2. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Workflow RPCs: only authenticated users may invoke; never anon
REVOKE EXECUTE ON FUNCTION public.accept_offer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_sail(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_arrived(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_part(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_part(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_job(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_offer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_arrived(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_part(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_part(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO authenticated;


-- ===== 20260701233012_478ac933-a22d-4530-9885-b13e4dffebf4.sql =====
-- Ensure profile is auto-created on signup via trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any missing profile rows for existing users so login doesn't hang.
-- Values are plain text so this works whether `role` / `preferred_language`
-- are enums or text on a pre-existing table.
INSERT INTO public.profiles (id, full_name, boat_name, role, preferred_language)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name',''),
       u.raw_user_meta_data->>'boat_name',
       COALESCE(u.raw_user_meta_data->>'role', 'Client'),
       COALESCE(u.raw_user_meta_data->>'preferred_language', 'tr')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;


-- ===== 20260701233814_d4ea6f7f-f8fb-4cbe-8033-a2b606ceb683.sql =====
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Temporary simulation profiles read access'
  ) THEN
    DROP POLICY IF EXISTS "Temporary simulation profiles read access" ON public.profiles;
    CREATE POLICY "Temporary simulation profiles read access"
    ON public.profiles
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Temporary simulation profiles create access'
  ) THEN
    DROP POLICY IF EXISTS "Temporary simulation profiles create access" ON public.profiles;
    CREATE POLICY "Temporary simulation profiles create access"
    ON public.profiles
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Temporary simulation profiles edit access'
  ) THEN
    DROP POLICY IF EXISTS "Temporary simulation profiles edit access" ON public.profiles;
    CREATE POLICY "Temporary simulation profiles edit access"
    ON public.profiles
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Temporary simulation jobs read access'
  ) THEN
    DROP POLICY IF EXISTS "Temporary simulation jobs read access" ON public.jobs;
    CREATE POLICY "Temporary simulation jobs read access"
    ON public.jobs
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Temporary simulation jobs create access'
  ) THEN
    DROP POLICY IF EXISTS "Temporary simulation jobs create access" ON public.jobs;
    CREATE POLICY "Temporary simulation jobs create access"
    ON public.jobs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Temporary simulation jobs edit access'
  ) THEN
    DROP POLICY IF EXISTS "Temporary simulation jobs edit access" ON public.jobs;
    CREATE POLICY "Temporary simulation jobs edit access"
    ON public.jobs
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;


-- ===== 20260702003227_0dd8814d-4d91-44db-abac-49060e76ae7d.sql =====

-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS account_type text,
  ADD COLUMN IF NOT EXISTS profile_picture_url text,
  ADD COLUMN IF NOT EXISTS emergency_health_note text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS base_location text,
  ADD COLUMN IF NOT EXISTS equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

-- 2. Vessels table
CREATE TABLE IF NOT EXISTS public.vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Boat',         -- Boat | RIB
  name text NOT NULL,
  vessel_type text,                              -- Sailing, Motor Yacht, Catamaran, Inflatable Bot
  length_m numeric,
  engine_model text,
  fuel_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vessels TO authenticated;
GRANT ALL ON public.vessels TO service_role;
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vessels_owner_all ON public.vessels;
CREATE POLICY vessels_owner_all ON public.vessels FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP TRIGGER IF EXISTS trg_vessels_updated ON public.vessels;
CREATE TRIGGER trg_vessels_updated BEFORE UPDATE ON public.vessels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Updated new-user handler with phone/account_type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, boat_name, role, preferred_language, phone, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'boat_name',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'Client'),
    coalesce((new.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr'),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'account_type','')
  );
  return new;
end $function$;

-- 4. Admin-only user directory (email + phone). SECURITY DEFINER: verifies has_role.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  phone text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.role, p.phone, u.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
      order by u.created_at desc;
end $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;


-- ===== 20260702004506_bc5cefdf-ca55-4115-8678-da31b7b36e22.sql =====

-- =========== Routine service packages ===========
CREATE TABLE IF NOT EXISTS public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title_tr text NOT NULL,
  title_en text NOT NULL,
  category text NOT NULL CHECK (category IN ('mechanic','diver')),
  base_duration_min int DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_packages TO anon, authenticated;
GRANT ALL ON public.service_packages TO service_role;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "packages_read_all" ON public.service_packages;
CREATE POLICY "packages_read_all" ON public.service_packages FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.provider_service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  eta_minutes int DEFAULT 120,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, package_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_service_packages TO authenticated;
GRANT ALL ON public.provider_service_packages TO service_role;
ALTER TABLE public.provider_service_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "psp_read_all_auth" ON public.provider_service_packages;
CREATE POLICY "psp_read_all_auth" ON public.provider_service_packages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "psp_owner_write" ON public.provider_service_packages;
CREATE POLICY "psp_owner_write" ON public.provider_service_packages FOR ALL TO authenticated
  USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());

-- =========== Spare parts marketplace ===========
CREATE TABLE IF NOT EXISTS public.parts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  brand text NOT NULL,
  category text NOT NULL,
  price numeric(10,2) NOT NULL,
  stock int NOT NULL DEFAULT 0,
  compatibility text[] DEFAULT '{}',
  marina text,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parts_catalog TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.parts_catalog TO authenticated;
GRANT ALL ON public.parts_catalog TO service_role;
ALTER TABLE public.parts_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parts_read_all" ON public.parts_catalog;
CREATE POLICY "parts_read_all" ON public.parts_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "parts_supplier_write" ON public.parts_catalog;
CREATE POLICY "parts_supplier_write" ON public.parts_catalog FOR ALL TO authenticated
  USING (supplier_id = auth.uid()) WITH CHECK (supplier_id = auth.uid());

CREATE INDEX IF NOT EXISTS parts_brand_cat_idx ON public.parts_catalog(brand, category);

CREATE TABLE IF NOT EXISTS public.part_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total numeric(10,2) NOT NULL,
  commission numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'Paid',
  delivery_marina text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.part_orders TO authenticated;
GRANT ALL ON public.part_orders TO service_role;
ALTER TABLE public.part_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_buyer_read" ON public.part_orders;
CREATE POLICY "orders_buyer_read" ON public.part_orders FOR SELECT TO authenticated USING (buyer_id = auth.uid());
DROP POLICY IF EXISTS "orders_buyer_insert" ON public.part_orders;
CREATE POLICY "orders_buyer_insert" ON public.part_orders FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.part_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.part_orders(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts_catalog(id),
  qty int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  name_snapshot text NOT NULL
);
GRANT SELECT, INSERT ON public.part_order_items TO authenticated;
GRANT ALL ON public.part_order_items TO service_role;
ALTER TABLE public.part_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_buyer_read" ON public.part_order_items;
CREATE POLICY "order_items_buyer_read" ON public.part_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.part_orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));
DROP POLICY IF EXISTS "order_items_buyer_insert" ON public.part_order_items;
CREATE POLICY "order_items_buyer_insert" ON public.part_order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.part_orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));

-- =========== RPC: checkout cart ===========
CREATE OR REPLACE FUNCTION public.checkout_parts_cart(_items jsonb, _delivery_marina text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order_id uuid;
  _total numeric := 0;
  _commission numeric;
  _item jsonb;
  _p public.parts_catalog%rowtype;
  _qty int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'part missing'; END IF;
    _qty := COALESCE((_item->>'qty')::int, 1);
    _total := _total + _p.price * _qty;
  END LOOP;
  _commission := round(_total * 0.10, 2);
  INSERT INTO public.part_orders(buyer_id, total, commission, delivery_marina)
    VALUES (auth.uid(), _total, _commission, _delivery_marina)
    RETURNING id INTO _order_id;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    _qty := COALESCE((_item->>'qty')::int, 1);
    INSERT INTO public.part_order_items(order_id, part_id, qty, unit_price, name_snapshot)
      VALUES (_order_id, _p.id, _qty, _p.price, _p.name);
    UPDATE public.parts_catalog SET stock = GREATEST(0, stock - _qty) WHERE id = _p.id;
  END LOOP;
  -- ledger commission
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (NULL, _commission, _total - _commission);
  RETURN _order_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text) TO authenticated;

-- Allow platform_ledger nullable job_id for parts commissions
ALTER TABLE public.platform_ledger ALTER COLUMN job_id DROP NOT NULL;

-- =========== Seed catalog ===========
INSERT INTO public.service_packages (key, title_tr, title_en, category, base_duration_min) VALUES
  ('svc_100h', '100 Saat Motor Servisi', '100-Hour Engine Service', 'mechanic', 180),
  ('svc_anode', 'Anot / Tutya Değişimi', 'Anode / Tutya Replacement', 'diver', 60),
  ('svc_hull', 'Karina Temizliği', 'Hull Cleaning', 'diver', 120),
  ('svc_impeller', 'Impeller Değişimi', 'Impeller Replacement', 'mechanic', 90),
  ('svc_winter', 'Kış Bakımı (Winterization)', 'Winterization Service', 'mechanic', 240)
ON CONFLICT (key) DO NOTHING;


-- ===== 20260702010230_acc156d4-4078-49b2-b303-1e06a84ef841.sql =====

-- 1. Add Supplier to role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Supplier';

-- 2. Extend profiles with supplier business fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS home_marina text,
  ADD COLUMN IF NOT EXISTS home_lat numeric,
  ADD COLUMN IF NOT EXISTS home_lng numeric;

-- 3. Extend parts_catalog with marina coordinates (fallback for delivery-time calc)
ALTER TABLE public.parts_catalog
  ADD COLUMN IF NOT EXISTS marina_lat numeric,
  ADD COLUMN IF NOT EXISTS marina_lng numeric;

-- 4. RLS: allow suppliers to manage their own inventory
DROP POLICY IF EXISTS "suppliers_manage_own_parts" ON public.parts_catalog;
CREATE POLICY "suppliers_manage_own_parts"
  ON public.parts_catalog
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());


-- ===== 20260702200645_7966d5d4-b13f-408b-a323-261f88a4dc87.sql =====

-- 1. Remove temporary permissive policies
DROP POLICY IF EXISTS "Temporary simulation jobs create access" ON public.jobs;
DROP POLICY IF EXISTS "Temporary simulation jobs edit access" ON public.jobs;
DROP POLICY IF EXISTS "Temporary simulation jobs read access" ON public.jobs;
DROP POLICY IF EXISTS "Temporary simulation profiles create access" ON public.profiles;
DROP POLICY IF EXISTS "Temporary simulation profiles edit access" ON public.profiles;
DROP POLICY IF EXISTS "Temporary simulation profiles read access" ON public.profiles;

-- 2. Prevent privilege escalation via profile self-update.
-- Trigger blocks changes to role and wallet_balance unless done by service_role or an admin.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    RAISE EXCEPTION 'Not allowed to change wallet_balance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_priv_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_priv_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 3. Restrict catalog reads to authenticated users
DROP POLICY IF EXISTS "parts_read_all" ON public.parts_catalog;
DROP POLICY IF EXISTS "parts_read_authenticated" ON public.parts_catalog;
CREATE POLICY "parts_read_authenticated" ON public.parts_catalog
FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "packages_read_all" ON public.service_packages;
DROP POLICY IF EXISTS "packages_read_authenticated" ON public.service_packages;
CREATE POLICY "packages_read_authenticated" ON public.service_packages
FOR SELECT TO authenticated USING (true);

-- 4. Lock down SECURITY DEFINER helpers from being called directly by clients.
-- has_role and set_updated_at are internal; other RPCs remain callable by authenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;


-- ===== 20260702201108_3ac2fc3b-99f2-4fbc-999a-6139338e2b92.sql =====

CREATE OR REPLACE FUNCTION public.mask_job_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original text := COALESCE(NEW.text, '');
  masked_text text := original;
  blocked text[] := '{}';
  forbidden text[] := ARRAY[
    'iban','bank','banka','hesap','transfer','havale','eft',
    'cash','nakit','elden',
    'whatsapp','wp','telegram','signal',
    'phone number','telefon','telefonum','ara beni','call me',
    'instagram','dm me'
  ];
  w text;
BEGIN
  -- Forbidden keyword redaction (word-boundary, case-insensitive)
  FOREACH w IN ARRAY forbidden LOOP
    IF masked_text ~* ('\m' || regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M') THEN
      blocked := array_append(blocked, w);
      masked_text := regexp_replace(masked_text,
        '\m' || regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M',
        '█████', 'gi');
    END IF;
  END LOOP;

  -- TR mobile / generic phone
  IF masked_text ~* '(\+?90 ?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}' THEN
    blocked := array_append(blocked, 'phone');
    masked_text := regexp_replace(masked_text,
      '(\+?90 ?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}',
      '███-███-████', 'gi');
  END IF;
  IF masked_text ~ '(\+?\d[\s\-().]?){7,}' THEN
    blocked := array_append(blocked, 'phone');
    masked_text := regexp_replace(masked_text,
      '(\+?\d[\s\-().]?){7,}', '███-███-████', 'g');
  END IF;

  -- IBAN
  IF masked_text ~* '[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}' THEN
    blocked := array_append(blocked, 'IBAN');
    masked_text := regexp_replace(masked_text,
      '[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}', '██ IBAN BLOCKED ██', 'gi');
  END IF;

  -- Email
  IF masked_text ~* '[[:alnum:]._+-]+@[[:alnum:]-]+\.[[:alnum:].-]+' THEN
    blocked := array_append(blocked, 'email');
    masked_text := regexp_replace(masked_text,
      '[[:alnum:]._+-]+@[[:alnum:]-]+\.[[:alnum:].-]+', '███@███', 'gi');
  END IF;

  NEW.text := masked_text;
  NEW.blocked_terms := (
    SELECT COALESCE(array_agg(DISTINCT x), '{}')
    FROM unnest(blocked) AS x
  );
  NEW.masked := array_length(NEW.blocked_terms, 1) IS NOT NULL
                AND array_length(NEW.blocked_terms, 1) > 0;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mask_job_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_messages_mask_before_insert ON public.job_messages;
CREATE TRIGGER job_messages_mask_before_insert
BEFORE INSERT ON public.job_messages
FOR EACH ROW EXECUTE FUNCTION public.mask_job_message();


-- ===== 20260702220131_7d755535-17cd-49f8-9a93-834760b3e9c6.sql =====

-- Extend part_orders with logistics fields
ALTER TABLE public.part_orders
  ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'service_boat',
  ADD COLUMN IF NOT EXISTS delivery_eta_minutes integer,
  ADD COLUMN IF NOT EXISTS delivery_location_label text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS dealer_note text,
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill subtotal from total on existing rows
UPDATE public.part_orders SET subtotal = total WHERE subtotal IS NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_part_orders_updated_at ON public.part_orders;
CREATE TRIGGER trg_part_orders_updated_at
  BEFORE UPDATE ON public.part_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Broaden status vocabulary (soft: text column, no enum change)
-- Allowed: Draft, Submitted, DealerReview, Confirmed, Preparing, OutForDelivery, Delivered, Completed, Cancelled, Paid (legacy)

-- Dealer visibility policy on part_orders
DROP POLICY IF EXISTS "orders_dealer_read" ON public.part_orders;
CREATE POLICY "orders_dealer_read" ON public.part_orders
  FOR SELECT TO authenticated
  USING (dealer_id = auth.uid());

DROP POLICY IF EXISTS "orders_dealer_update" ON public.part_orders;
CREATE POLICY "orders_dealer_update" ON public.part_orders
  FOR UPDATE TO authenticated
  USING (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- Admin visibility
DROP POLICY IF EXISTS "orders_admin_read" ON public.part_orders;
CREATE POLICY "orders_admin_read" ON public.part_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Dealer visibility for order items
DROP POLICY IF EXISTS "order_items_dealer_read" ON public.part_order_items;
CREATE POLICY "order_items_dealer_read" ON public.part_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.part_orders o
    WHERE o.id = part_order_items.order_id AND o.dealer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "order_items_admin_read" ON public.part_order_items;
CREATE POLICY "order_items_admin_read" ON public.part_order_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Rewrite checkout function to capture logistics + dealer
CREATE OR REPLACE FUNCTION public.checkout_parts_cart(
  _items jsonb,
  _delivery_marina text,
  _vessel_id uuid DEFAULT NULL,
  _delivery_method text DEFAULT 'service_boat',
  _delivery_eta_minutes integer DEFAULT NULL,
  _delivery_location_label text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order_id uuid;
  _total numeric := 0;
  _commission numeric;
  _item jsonb;
  _p public.parts_catalog%rowtype;
  _qty int;
  _dealer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  -- Compute total and resolve dealer from first item (single-dealer orders v1)
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'part missing'; END IF;
    _qty := COALESCE((_item->>'qty')::int, 1);
    _total := _total + _p.price * _qty;
    IF _dealer IS NULL THEN _dealer := _p.supplier_id; END IF;
  END LOOP;

  _commission := round(_total * 0.10, 2);

  INSERT INTO public.part_orders(
    buyer_id, dealer_id, vessel_id, total, subtotal, commission,
    delivery_marina, delivery_method, delivery_eta_minutes,
    delivery_location_label, notes, status
  ) VALUES (
    auth.uid(), _dealer, _vessel_id, _total, _total, _commission,
    _delivery_marina, COALESCE(_delivery_method, 'service_boat'),
    _delivery_eta_minutes, _delivery_location_label, _notes, 'Submitted'
  ) RETURNING id INTO _order_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    _qty := COALESCE((_item->>'qty')::int, 1);
    INSERT INTO public.part_order_items(order_id, part_id, qty, unit_price, name_snapshot)
      VALUES (_order_id, _p.id, _qty, _p.price, _p.name);
    UPDATE public.parts_catalog SET stock = GREATEST(0, stock - _qty) WHERE id = _p.id;
  END LOOP;

  -- TODO(phase-9): defer ledger insert until dealer marks Delivered / escrow release.
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (NULL, _commission, _total - _commission);

  -- TODO(phase-9): Stripe payment intent + escrow hold, courier assignment,
  -- invoice generation, audit log entry.

  RETURN _order_id;
END $function$;


-- ===== 20260702222815_40946155-5a64-44d0-a9b3-bd39b5944770.sql =====
-- M7 Event Architecture v1 — platform_events table.
CREATE TABLE IF NOT EXISTS public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  subject_type text NOT NULL,
  subject_id uuid,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_events_created_at_idx ON public.platform_events (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_events_actor_idx ON public.platform_events (actor_id);
CREATE INDEX IF NOT EXISTS platform_events_subject_idx ON public.platform_events (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS platform_events_type_idx ON public.platform_events (event_type);

GRANT SELECT, INSERT ON public.platform_events TO authenticated;
GRANT ALL ON public.platform_events TO service_role;

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all events.
DROP POLICY IF EXISTS "Admins can read all events" ON public.platform_events;
CREATE POLICY "Admins can read all events"
  ON public.platform_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read events they authored.
DROP POLICY IF EXISTS "Users can read their own events" ON public.platform_events;
CREATE POLICY "Users can read their own events"
  ON public.platform_events FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

-- Authenticated users may insert safe client events, but ONLY as themselves.
-- TODO(M7): move privileged event writing to server functions / DB triggers
-- so trust/audit events cannot be forged. Client inserts should be limited
-- to non-privileged UI telemetry (viewed, opened) once server writers exist.
DROP POLICY IF EXISTS "Users can insert events as themselves" ON public.platform_events;
CREATE POLICY "Users can insert events as themselves"
  ON public.platform_events FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);


-- ===== 20260702230818_03f39741-16ea-4398-83cd-3233467f7a1e.sql =====

-- ============================================================
-- M9 · Payment / Escrow architecture v1
-- ============================================================

-- ----- payment_intents -----
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.job_offers(id) ON DELETE SET NULL,
  captain_id uuid NOT NULL,
  provider_id uuid,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','pending','secured','released','refunded','failed')),
  provider text NOT NULL DEFAULT 'simulated',
  external_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  secured_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_intents_job_idx      ON public.payment_intents(job_id);
CREATE INDEX IF NOT EXISTS payment_intents_captain_idx  ON public.payment_intents(captain_id);
CREATE INDEX IF NOT EXISTS payment_intents_provider_idx ON public.payment_intents(provider_id);
CREATE INDEX IF NOT EXISTS payment_intents_status_idx   ON public.payment_intents(status);

GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL    ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pi captain read" ON public.payment_intents;
CREATE POLICY "pi captain read"  ON public.payment_intents FOR SELECT TO authenticated USING (captain_id = auth.uid());
DROP POLICY IF EXISTS "pi provider read" ON public.payment_intents;
CREATE POLICY "pi provider read" ON public.payment_intents FOR SELECT TO authenticated USING (provider_id = auth.uid());
DROP POLICY IF EXISTS "pi admin read" ON public.payment_intents;
CREATE POLICY "pi admin read"    ON public.payment_intents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payment_intents_set_updated_at BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- escrow_transactions -----
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (kind IN ('secure','release','refund','extra_secure','extra_release')),
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  actor_id uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS escrow_tx_job_idx    ON public.escrow_transactions(job_id);
CREATE INDEX IF NOT EXISTS escrow_tx_kind_idx   ON public.escrow_transactions(kind);

GRANT SELECT ON public.escrow_transactions TO authenticated;
GRANT ALL    ON public.escrow_transactions TO service_role;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etx captain read" ON public.escrow_transactions;
CREATE POLICY "etx captain read"  ON public.escrow_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = escrow_transactions.job_id AND j.client_id = auth.uid()));
DROP POLICY IF EXISTS "etx provider read" ON public.escrow_transactions;
CREATE POLICY "etx provider read" ON public.escrow_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = escrow_transactions.job_id AND j.provider_id = auth.uid()));
DROP POLICY IF EXISTS "etx admin read" ON public.escrow_transactions;
CREATE POLICY "etx admin read"    ON public.escrow_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ----- provider_payouts -----
CREATE TABLE IF NOT EXISTS public.provider_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  external_ref text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_payouts_provider_idx ON public.provider_payouts(provider_id);
CREATE INDEX IF NOT EXISTS provider_payouts_job_idx      ON public.provider_payouts(job_id);
CREATE INDEX IF NOT EXISTS provider_payouts_status_idx   ON public.provider_payouts(status);

GRANT SELECT ON public.provider_payouts TO authenticated;
GRANT ALL    ON public.provider_payouts TO service_role;
ALTER TABLE public.provider_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout provider read" ON public.provider_payouts;
CREATE POLICY "payout provider read" ON public.provider_payouts FOR SELECT TO authenticated USING (provider_id = auth.uid());
DROP POLICY IF EXISTS "payout captain read" ON public.provider_payouts;
CREATE POLICY "payout captain read"  ON public.provider_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = provider_payouts.job_id AND j.client_id = auth.uid()));
DROP POLICY IF EXISTS "payout admin read" ON public.provider_payouts;
CREATE POLICY "payout admin read"    ON public.provider_payouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER provider_payouts_set_updated_at BEFORE UPDATE ON public.provider_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- commission_records -----
CREATE TABLE IF NOT EXISTS public.commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  gross_cents bigint NOT NULL,
  fee_cents bigint NOT NULL,
  net_cents bigint NOT NULL,
  rate numeric(5,4) NOT NULL DEFAULT 0.1000,
  currency text NOT NULL DEFAULT 'EUR',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commission_records_job_idx ON public.commission_records(job_id);

GRANT SELECT ON public.commission_records TO authenticated;
GRANT ALL    ON public.commission_records TO service_role;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission captain read" ON public.commission_records;
CREATE POLICY "commission captain read" ON public.commission_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = commission_records.job_id AND j.client_id = auth.uid()));
DROP POLICY IF EXISTS "commission provider read" ON public.commission_records;
CREATE POLICY "commission provider read" ON public.commission_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = commission_records.job_id AND j.provider_id = auth.uid()));
DROP POLICY IF EXISTS "commission admin read" ON public.commission_records;
CREATE POLICY "commission admin read"   ON public.commission_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- Helper RPC · record_payment_intent
-- Called by the captain AFTER accept_offer runs.
-- Simulated mode: marks the intent 'secured' immediately.
-- TODO(payments-provider): swap to 'pending' and finalize via
--   provider webhook (Stripe Connect / iyzico / PayTR).
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment_intent(_job_id uuid, _offer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job public.jobs%ROWTYPE;
  _offer public.job_offers%ROWTYPE;
  _amount bigint;
  _intent_id uuid;
BEGIN
  SELECT * INTO _job FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND OR _job.client_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO _offer FROM public.job_offers WHERE id = _offer_id AND job_id = _job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer missing'; END IF;

  _amount := (round(_offer.price * 100))::bigint;

  INSERT INTO public.payment_intents(
    job_id, offer_id, captain_id, provider_id,
    amount_cents, currency, status, provider, secured_at
  ) VALUES (
    _job_id, _offer_id, _job.client_id, _offer.provider_id,
    _amount, 'EUR', 'secured', 'simulated', now()
  )
  RETURNING id INTO _intent_id;

  INSERT INTO public.escrow_transactions(
    job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
  ) VALUES (
    _job_id, _intent_id, 'secure', _amount, 'EUR', auth.uid(),
    'Simulated funding — payment provider not yet connected'
  );

  RETURN _intent_id;
END $$;

REVOKE ALL ON FUNCTION public.record_payment_intent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_intent(uuid, uuid) TO authenticated;

-- ============================================================
-- Upgrade complete_job to also write commission + payout rows.
-- Keeps platform_ledger insert for backward compatibility.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_job(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total numeric;
  commission numeric;
  payout numeric;
  prov uuid;
  _gross bigint;
  _fee bigint;
  _net bigint;
  _intent_id uuid;
BEGIN
  SELECT total_escrow_pool, provider_id INTO total, prov FROM public.jobs
    WHERE id = _job_id AND client_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  commission := round(total * 0.10);
  payout := total - commission;

  UPDATE public.jobs SET status = 'Completed' WHERE id = _job_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + payout WHERE id = prov;
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (_job_id, commission, payout);

  -- M9 payment/escrow lifecycle ---------------------------------
  _gross := (round(total * 100))::bigint;
  _fee   := (round(commission * 100))::bigint;
  _net   := _gross - _fee;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured'
    ORDER BY created_at DESC LIMIT 1;

  IF _intent_id IS NOT NULL THEN
    UPDATE public.payment_intents
      SET status = 'released', released_at = now(),
          amount_cents = _gross
      WHERE id = _intent_id;

    INSERT INTO public.escrow_transactions(
      job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
    ) VALUES (
      _job_id, _intent_id, 'release', _gross, 'EUR', auth.uid(),
      'Captain confirmed mission completion'
    );
  END IF;

  INSERT INTO public.commission_records(
    job_id, payment_intent_id, gross_cents, fee_cents, net_cents, rate, currency
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'EUR');

  IF prov IS NOT NULL THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id,
      amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'EUR', 'pending');
    -- TODO(payments-provider): trigger real payout job (Stripe Connect transfer,
    -- iyzico settlement, PayTR withdrawal) and mark status='completed' via webhook.
  END IF;
END $$;


-- ===== 20260702233815_91ea9ebd-14a5-4890-a327-579280cb18ea.sql =====

-- Revoke default PUBLIC execute on every SECURITY DEFINER function,
-- then grant back only what the app truly needs.

-- Trigger-only functions: no direct callers.
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mask_job_message() FROM PUBLIC, anon, authenticated;

-- Role check: used by RLS policies as the signed-in user.
REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;

-- Mission / offers / parts RPCs — signed-in users only.
REVOKE ALL ON FUNCTION public.set_sail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sail(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_arrived(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_arrived(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_offer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_part(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_part(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_part(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_part(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) TO authenticated;

-- Admin listing: self-guarded via has_role('admin').
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Marketplace checkout (both overloads).
REVOKE ALL ON FUNCTION public.checkout_parts_cart(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.checkout_parts_cart(jsonb, text, uuid, text, integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text, uuid, text, integer, text, text)
  TO authenticated;

-- Payments / escrow lifecycle RPCs.
REVOKE ALL ON FUNCTION public.record_payment_intent(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_intent(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO authenticated;


-- ===== 20260704180221_a11d8676-f66d-49ee-8d80-89cbe6d71523.sql =====

CREATE OR REPLACE FUNCTION public.is_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role::text = 'Provider'
  )
$$;

-- Add a permissive SELECT policy so any Provider (with or without a
-- provider_details row / service_type match) can see the open pool.
-- Client UI badges category so mismatched providers can self-filter.
DROP POLICY IF EXISTS "jobs: providers read open pool (role)" ON public.jobs;
CREATE POLICY "jobs: providers read open pool (role)"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  status = 'Pending'::job_status
  AND public.is_provider(auth.uid())
);


-- ===== 20260704181153_fb2ab6b7-641b-4e36-a3e9-6dde9589ea55.sql =====
-- P0 fix: providers without a matching provider_details row (or with a
-- different service_type) currently cannot insert offers. Mirror the
-- previously-added role-based read pool policy with a role-based insert
-- policy so any Provider can bid on any Pending job. The strict
-- service_type-scoped policy remains as an alternative permissive path.

DROP POLICY IF EXISTS "offers: providers insert on open jobs (role)" ON public.job_offers;
CREATE POLICY "offers: providers insert on open jobs (role)"
ON public.job_offers
FOR INSERT
TO authenticated
WITH CHECK (
  provider_id = auth.uid()
  AND public.is_provider(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_offers.job_id
      AND j.status = 'Pending'::public.job_status
  )
);


-- ===== 20260704184344_ab2b6ddc-8190-4257-89ab-66fe11cb3903.sql =====

-- 1. Restrict is_provider() SECURITY DEFINER function to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_provider(uuid) FROM PUBLIC, anon;

-- 2. Scope provider_details read access
DROP POLICY IF EXISTS "providers: readable by all authed" ON public.provider_details;
DROP POLICY IF EXISTS "provider_details: scoped read" ON public.provider_details;
CREATE POLICY "provider_details: scoped read"
ON public.provider_details
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR live_status = 'Available'
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.provider_id = provider_details.id AND j.client_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.job_offers o
    JOIN public.jobs j ON j.id = o.job_id
    WHERE o.provider_id = provider_details.id AND j.client_id = auth.uid()
  )
);

-- 3. Scope provider_service_packages read access
DROP POLICY IF EXISTS "psp_read_all_auth" ON public.provider_service_packages;
DROP POLICY IF EXISTS "psp: scoped read" ON public.provider_service_packages;
CREATE POLICY "psp: scoped read"
ON public.provider_service_packages
FOR SELECT
TO authenticated
USING (
  provider_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.provider_details pd
    WHERE pd.id = provider_service_packages.provider_id
      AND pd.live_status = 'Available'
  )
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.provider_id = provider_service_packages.provider_id
      AND j.client_id = auth.uid()
  )
);


-- ===== 20260704194826_dde0613b-0ff5-443c-95b1-dba28c56fcba.sql =====

-- Helpers to break RLS recursion between profiles → jobs → provider_details → jobs.
-- All SECURITY DEFINER so cross-table lookups bypass RLS and cannot re-enter policy checks.

CREATE OR REPLACE FUNCTION public.user_is_job_participant_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE (j.client_id = auth.uid() AND j.provider_id = _other)
       OR (j.provider_id = auth.uid() AND j.client_id = _other)
  ) OR EXISTS (
    SELECT 1
    FROM public.job_offers o
    JOIN public.jobs j ON j.id = o.job_id
    WHERE (o.provider_id = _other AND j.client_id = auth.uid())
       OR (o.provider_id = auth.uid() AND j.client_id = _other)
  );
$$;

CREATE OR REPLACE FUNCTION public.provider_is_available(_provider uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_details pd
    WHERE pd.id = _provider AND pd.live_status = 'Available'
  );
$$;

CREATE OR REPLACE FUNCTION public.provider_offers_service(_provider uuid, _service public.service_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_details pd
    WHERE pd.id = _provider AND pd.service_type = _service
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_is_job_participant_with(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.provider_is_available(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.provider_offers_service(uuid, public.service_type) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_is_job_participant_with(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_is_available(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_offers_service(uuid, public.service_type) TO authenticated, service_role;

-- A. profiles: replace recursive cross-table EXISTS with helper.
DROP POLICY IF EXISTS "Profiles: job participants read" ON public.profiles;
CREATE POLICY "Profiles: job participants read"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.user_is_job_participant_with(profiles.id));

-- B. provider_details: no direct jobs/job_offers references.
DROP POLICY IF EXISTS "provider_details: scoped read" ON public.provider_details;
CREATE POLICY "provider_details: scoped read"
ON public.provider_details
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR live_status = 'Available'
  OR public.user_is_job_participant_with(provider_details.id)
);

-- C. jobs open pool: replace direct provider_details EXISTS with helper.
DROP POLICY IF EXISTS "jobs: providers read open pool" ON public.jobs;
CREATE POLICY "jobs: providers read open pool"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  status = 'Pending'::job_status
  AND public.provider_offers_service(auth.uid(), jobs.service_type)
);


-- ===== 20260704200825_200a2701-fa36-4c87-99f8-ba9270b27c22.sql =====
CREATE OR REPLACE FUNCTION public.approve_part(_part_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.job_parts%rowtype;
begin
  select * into p from public.job_parts where id=_part_id;
  if not found then raise exception 'Part not found'; end if;
  if not exists (select 1 from public.jobs where id=p.job_id and client_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.job_parts set payment_status='Paid' where id=_part_id;
  update public.jobs
    set extra_parts_cost = extra_parts_cost + p.part_price,
        total_escrow_pool = total_escrow_pool + p.part_price,
        status = (case when exists(select 1 from public.job_parts where job_id=p.job_id and payment_status='Pending')
                      then 'PartsPending' else 'InProgress' end)::public.job_status
    where id=p.job_id;
end $function$;

CREATE OR REPLACE FUNCTION public.reject_part(_part_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.job_parts%rowtype;
begin
  select * into p from public.job_parts where id=_part_id;
  if not exists (select 1 from public.jobs where id=p.job_id and client_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.job_parts set payment_status='Rejected' where id=_part_id;
  update public.jobs
    set status = (case when exists(select 1 from public.job_parts where job_id=p.job_id and payment_status='Pending')
                      then 'PartsPending' else 'InProgress' end)::public.job_status
    where id=p.job_id;
end $function$;

CREATE OR REPLACE FUNCTION public.add_extra_part(_job_id uuid, _name text, _price numeric, _photo text, _source text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _id uuid;
begin
  if not exists (select 1 from public.jobs where id=_job_id and provider_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  insert into public.job_parts(job_id, part_name, part_price, part_image_url, source)
    values (_job_id, _name, _price, _photo, coalesce(_source,'Tedarikçi Firma (Local Supplier)'))
    returning id into _id;
  update public.jobs set status='PartsPending'::public.job_status where id=_job_id;
  return _id;
end $function$;


-- ===== 20260704201734_29a8c345-06c5-42d4-94ac-ac7441ddcda5.sql =====
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    IF current_setting('thalvo.internal_wallet_credit', true) <> 'on' THEN
      RAISE EXCEPTION 'Not allowed to change wallet_balance';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_job(_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total numeric;
  commission numeric;
  payout numeric;
  prov uuid;
  _gross bigint;
  _fee bigint;
  _net bigint;
  _intent_id uuid;
BEGIN
  SELECT total_escrow_pool, provider_id INTO total, prov FROM public.jobs
    WHERE id = _job_id AND client_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  commission := round(total * 0.10);
  payout := total - commission;

  UPDATE public.jobs SET status = 'Completed' WHERE id = _job_id;

  -- Transaction-scoped internal flag: lets prevent_profile_privilege_escalation
  -- allow the wallet_balance credit that only this RPC is supposed to make.
  PERFORM set_config('thalvo.internal_wallet_credit', 'on', true);
  UPDATE public.profiles SET wallet_balance = wallet_balance + payout WHERE id = prov;
  PERFORM set_config('thalvo.internal_wallet_credit', 'off', true);

  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (_job_id, commission, payout);

  _gross := (round(total * 100))::bigint;
  _fee   := (round(commission * 100))::bigint;
  _net   := _gross - _fee;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured'
    ORDER BY created_at DESC LIMIT 1;

  IF _intent_id IS NOT NULL THEN
    UPDATE public.payment_intents
      SET status = 'released', released_at = now(),
          amount_cents = _gross
      WHERE id = _intent_id;

    INSERT INTO public.escrow_transactions(
      job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
    ) VALUES (
      _job_id, _intent_id, 'release', _gross, 'EUR', auth.uid(),
      'Captain confirmed mission completion'
    );
  END IF;

  INSERT INTO public.commission_records(
    job_id, payment_intent_id, gross_cents, fee_cents, net_cents, rate, currency
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'EUR');

  IF prov IS NOT NULL THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id,
      amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'EUR', 'pending');
  END IF;
END $function$;


-- ===== 20260706135221_a2a8d1e9-1f7e-4dd7-af38-b07a589f6834.sql =====

UPDATE public.payment_intents SET currency='TRY' WHERE currency='EUR';
UPDATE public.escrow_transactions SET currency='TRY' WHERE currency='EUR';
UPDATE public.commission_records SET currency='TRY' WHERE currency='EUR';
UPDATE public.provider_payouts SET currency='TRY' WHERE currency='EUR';

CREATE OR REPLACE FUNCTION public.record_payment_intent(_job_id uuid, _offer_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _job public.jobs%ROWTYPE;
  _offer public.job_offers%ROWTYPE;
  _amount bigint;
  _intent_id uuid;
BEGIN
  SELECT * INTO _job FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND OR _job.client_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO _offer FROM public.job_offers WHERE id = _offer_id AND job_id = _job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer missing'; END IF;

  _amount := (round(_offer.price * 100))::bigint;

  INSERT INTO public.payment_intents(
    job_id, offer_id, captain_id, provider_id,
    amount_cents, currency, status, provider, secured_at
  ) VALUES (
    _job_id, _offer_id, _job.client_id, _offer.provider_id,
    _amount, 'TRY', 'secured', 'simulated', now()
  )
  RETURNING id INTO _intent_id;

  INSERT INTO public.escrow_transactions(
    job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
  ) VALUES (
    _job_id, _intent_id, 'secure', _amount, 'TRY', auth.uid(),
    'Simulated funding — payment provider not yet connected'
  );

  RETURN _intent_id;
END $function$;

CREATE OR REPLACE FUNCTION public.complete_job(_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total numeric;
  commission numeric;
  payout numeric;
  prov uuid;
  _gross bigint;
  _fee bigint;
  _net bigint;
  _intent_id uuid;
BEGIN
  SELECT total_escrow_pool, provider_id INTO total, prov FROM public.jobs
    WHERE id = _job_id AND client_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  commission := round(total * 0.10);
  payout := total - commission;

  UPDATE public.jobs SET status = 'Completed' WHERE id = _job_id;

  PERFORM set_config('thalvo.internal_wallet_credit', 'on', true);
  UPDATE public.profiles SET wallet_balance = wallet_balance + payout WHERE id = prov;
  PERFORM set_config('thalvo.internal_wallet_credit', 'off', true);

  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (_job_id, commission, payout);

  _gross := (round(total * 100))::bigint;
  _fee   := (round(commission * 100))::bigint;
  _net   := _gross - _fee;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured'
    ORDER BY created_at DESC LIMIT 1;

  IF _intent_id IS NOT NULL THEN
    UPDATE public.payment_intents
      SET status = 'released', released_at = now(),
          amount_cents = _gross
      WHERE id = _intent_id;

    INSERT INTO public.escrow_transactions(
      job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
    ) VALUES (
      _job_id, _intent_id, 'release', _gross, 'TRY', auth.uid(),
      'Captain confirmed mission completion'
    );
  END IF;

  INSERT INTO public.commission_records(
    job_id, payment_intent_id, gross_cents, fee_cents, net_cents, rate, currency
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'TRY');

  IF prov IS NOT NULL THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id,
      amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'TRY', 'pending');
  END IF;
END $function$;


-- ===== 20260710113931_2c9923c6-dd56-4042-87c9-fde892d677ed.sql =====

-- Public read for part-images bucket (bucket is public, but add explicit policy for clarity)
DROP POLICY IF EXISTS "part_images_public_read" ON storage.objects;
CREATE POLICY "part_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'part-images');

DROP POLICY IF EXISTS "part_images_owner_insert" ON storage.objects;
CREATE POLICY "part_images_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "part_images_owner_update" ON storage.objects;
CREATE POLICY "part_images_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "part_images_owner_delete" ON storage.objects;
CREATE POLICY "part_images_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ===== 20260710122038_9494387f-3b87-4e90-b826-30cef22f8640.sql =====
-- Prevent stock from ever going negative at the database level.
ALTER TABLE public.parts_catalog
  DROP CONSTRAINT IF EXISTS parts_catalog_stock_nonnegative;
ALTER TABLE public.parts_catalog
  ADD CONSTRAINT parts_catalog_stock_nonnegative CHECK (stock >= 0);

CREATE OR REPLACE FUNCTION public.checkout_parts_cart(
  _items jsonb,
  _delivery_marina text,
  _vessel_id uuid DEFAULT NULL,
  _delivery_method text DEFAULT 'service_boat',
  _delivery_eta_minutes integer DEFAULT NULL,
  _delivery_location_label text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _order_id uuid;
  _total numeric := 0;
  _commission numeric;
  _item jsonb;
  _p public.parts_catalog%rowtype;
  _qty int;
  _dealer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  -- Phase 1: lock rows, validate stock, compute totals. Nothing is written yet,
  -- so any RAISE below aborts the transaction with no order/items/stock changes.
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog
      WHERE id = (_item->>'part_id')::uuid
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: part missing';
    END IF;
    _qty := COALESCE((_item->>'qty')::int, 1);
    IF _qty <= 0 THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: invalid qty for %', _p.name;
    END IF;
    IF _p.stock < _qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: % (available %, requested %)',
        _p.name, _p.stock, _qty;
    END IF;
    _total := _total + _p.price * _qty;
    IF _dealer IS NULL THEN _dealer := _p.supplier_id; END IF;
  END LOOP;

  _commission := round(_total * 0.10, 2);

  -- Phase 2: create order + items and decrement stock.
  INSERT INTO public.part_orders(
    buyer_id, dealer_id, vessel_id, total, subtotal, commission,
    delivery_marina, delivery_method, delivery_eta_minutes,
    delivery_location_label, notes, status
  ) VALUES (
    auth.uid(), _dealer, _vessel_id, _total, _total, _commission,
    _delivery_marina, COALESCE(_delivery_method, 'service_boat'),
    _delivery_eta_minutes, _delivery_location_label, _notes, 'Submitted'
  ) RETURNING id INTO _order_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog
      WHERE id = (_item->>'part_id')::uuid
      FOR UPDATE;
    _qty := COALESCE((_item->>'qty')::int, 1);
    INSERT INTO public.part_order_items(order_id, part_id, qty, unit_price, name_snapshot)
      VALUES (_order_id, _p.id, _qty, _p.price, _p.name);
    -- Rows are already locked and validated above; the CHECK constraint is a
    -- final safeguard against races or malformed callers.
    UPDATE public.parts_catalog
      SET stock = stock - _qty
      WHERE id = _p.id;
  END LOOP;

  -- TODO(phase-9): defer ledger insert until dealer marks Delivered / escrow release.
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (NULL, _commission, _total - _commission);

  RETURN _order_id;
END
$function$;


-- ===== 20260710123237_94462330-4579-4f8a-86c0-e10c386c0314.sql =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'part_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.part_orders;
  END IF;
END $$;


-- ===== 20260715150256_ed800e36-a681-42b7-b068-39bec630349a.sql =====
-- Fix: Public bucket allows listing — drop broad SELECT policy on storage.objects for part-images.
-- Public bucket files remain accessible via public CDN URLs (getPublicUrl) without needing a SELECT RLS policy.
-- Removing the policy prevents anonymous clients from listing/enumerating all files in the bucket.
DROP POLICY IF EXISTS part_images_public_read ON storage.objects;

-- Fix: provider_details missing explicit DELETE policy — add owner/admin scoped DELETE policy.
DROP POLICY IF EXISTS "provider_details: owner or admin delete" ON public.provider_details;
CREATE POLICY "provider_details: owner or admin delete"
  ON public.provider_details
  FOR DELETE
  TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));


-- ===== 20260729225749_43643ccb-80d6-4a88-804f-12db27223423.sql =====
-- 1. Remove duplicate commission rows produced by the non-idempotent complete_job
DELETE FROM public.commission_records cr
USING (
  SELECT id, row_number() OVER (PARTITION BY job_id ORDER BY created_at, id) AS rn
  FROM public.commission_records
) d
WHERE cr.id = d.id AND d.rn > 1;

ALTER TABLE public.commission_records
  ADD CONSTRAINT commission_records_job_id_unique UNIQUE (job_id);

-- 2. Idempotency for secured payment intents
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_one_secured_per_job
  ON public.payment_intents (job_id)
  WHERE status = 'secured';

-- 3. Sane bounds for extra parts
ALTER TABLE public.job_parts
  ADD CONSTRAINT job_parts_price_sane CHECK (part_price > 0 AND part_price <= 1000000);

-- 4. complete_job: idempotent, status-guarded
CREATE OR REPLACE FUNCTION public.complete_job(_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total numeric;
  commission numeric;
  payout numeric;
  prov uuid;
  _gross bigint;
  _fee bigint;
  _net bigint;
  _intent_id uuid;
BEGIN
  -- Lock the row and require a non-terminal status. This is the idempotency
  -- guard: a second call finds no row and exits without crediting again.
  SELECT total_escrow_pool, provider_id INTO total, prov
    FROM public.jobs
    WHERE id = _job_id
      AND client_id = auth.uid()
      AND status NOT IN ('Completed', 'Cancelled')
    FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.jobs WHERE id = _job_id AND client_id = auth.uid()) THEN
      RETURN; -- already completed/cancelled: no-op, not an error
    END IF;
    RAISE EXCEPTION 'Not authorized';
  END IF;

  commission := round(total * 0.10);
  payout := total - commission;

  UPDATE public.jobs SET status = 'Completed' WHERE id = _job_id;

  PERFORM set_config('thalvo.internal_wallet_credit', 'on', true);
  UPDATE public.profiles SET wallet_balance = wallet_balance + payout WHERE id = prov;
  PERFORM set_config('thalvo.internal_wallet_credit', 'off', true);

  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (_job_id, commission, payout);

  _gross := (round(total * 100))::bigint;
  _fee   := (round(commission * 100))::bigint;
  _net   := _gross - _fee;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured'
    ORDER BY created_at DESC LIMIT 1;

  IF _intent_id IS NOT NULL THEN
    UPDATE public.payment_intents
      SET status = 'released', released_at = now(), amount_cents = _gross
      WHERE id = _intent_id;

    INSERT INTO public.escrow_transactions(
      job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
    ) VALUES (
      _job_id, _intent_id, 'release', _gross, 'TRY', auth.uid(),
      'Captain confirmed mission completion'
    );
  END IF;

  INSERT INTO public.commission_records(
    job_id, payment_intent_id, gross_cents, fee_cents, net_cents, rate, currency
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'TRY')
  ON CONFLICT (job_id) DO NOTHING;

  IF prov IS NOT NULL THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id, amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'TRY', 'pending');
  END IF;
END $function$;

-- 5. accept_offer: status-guarded
CREATE OR REPLACE FUNCTION public.accept_offer(_job_id uuid, _offer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.job_offers%rowtype;
begin
  select * into o from public.job_offers where id = _offer_id and job_id = _job_id;
  if not found then raise exception 'Offer not found'; end if;
  update public.jobs
    set provider_id = o.provider_id,
        initial_labor_cost = o.price,
        total_escrow_pool = o.price,
        eta_minutes = o.eta_minutes,
        status = 'Accepted'
    where id = _job_id
      and client_id = auth.uid()
      and status in ('Pending', 'Offered');
  if not found then raise exception 'Not authorized'; end if;
end $function$;

-- 6. record_payment_intent: reuse an existing secured intent instead of duplicating
CREATE OR REPLACE FUNCTION public.record_payment_intent(_job_id uuid, _offer_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _job public.jobs%ROWTYPE;
  _offer public.job_offers%ROWTYPE;
  _amount bigint;
  _intent_id uuid;
BEGIN
  SELECT * INTO _job FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND OR _job.client_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured' LIMIT 1;
  IF _intent_id IS NOT NULL THEN
    RETURN _intent_id;
  END IF;

  SELECT * INTO _offer FROM public.job_offers WHERE id = _offer_id AND job_id = _job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer missing'; END IF;

  _amount := (round(_offer.price * 100))::bigint;

  INSERT INTO public.payment_intents(
    job_id, offer_id, captain_id, provider_id,
    amount_cents, currency, status, provider, secured_at
  ) VALUES (
    _job_id, _offer_id, _job.client_id, _offer.provider_id,
    _amount, 'TRY', 'secured', 'simulated', now()
  )
  RETURNING id INTO _intent_id;

  INSERT INTO public.escrow_transactions(
    job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
  ) VALUES (
    _job_id, _intent_id, 'secure', _amount, 'TRY', auth.uid(),
    'Simulated funding — payment provider not yet connected'
  );

  RETURN _intent_id;
END $function$;


-- ===== 20260729225821_04082a0f-d88b-465f-95fb-3885e716fb00.sql =====
CREATE TABLE IF NOT EXISTS public.verified_dealers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.verified_dealers TO authenticated;
GRANT ALL ON public.verified_dealers TO service_role;

ALTER TABLE public.verified_dealers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verified_dealers: read own or admin" ON public.verified_dealers;
CREATE POLICY "verified_dealers: read own or admin"
  ON public.verified_dealers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "verified_dealers: admin insert" ON public.verified_dealers;
CREATE POLICY "verified_dealers: admin insert"
  ON public.verified_dealers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "verified_dealers: admin update" ON public.verified_dealers;
CREATE POLICY "verified_dealers: admin update"
  ON public.verified_dealers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "verified_dealers: admin delete" ON public.verified_dealers;
CREATE POLICY "verified_dealers: admin delete"
  ON public.verified_dealers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER verified_dealers_set_updated_at
  BEFORE UPDATE ON public.verified_dealers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grandfather every account that already has catalog rows.
INSERT INTO public.verified_dealers(user_id, note)
SELECT DISTINCT supplier_id, 'grandfathered: had live catalog rows'
FROM public.parts_catalog
WHERE supplier_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_verified_dealer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.verified_dealers vd WHERE vd.user_id = _user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.is_verified_dealer(uuid) FROM anon;

-- Replace the unrestricted write policies.
DROP POLICY IF EXISTS "parts_supplier_write" ON public.parts_catalog;
DROP POLICY IF EXISTS "suppliers_manage_own_parts" ON public.parts_catalog;

DROP POLICY IF EXISTS "parts: verified dealer manage own" ON public.parts_catalog;
CREATE POLICY "parts: verified dealer manage own"
  ON public.parts_catalog FOR ALL TO authenticated
  USING (supplier_id = auth.uid() AND public.is_verified_dealer(auth.uid()))
  WITH CHECK (supplier_id = auth.uid() AND public.is_verified_dealer(auth.uid()));

DROP POLICY IF EXISTS "parts: admin manage all" ON public.parts_catalog;
CREATE POLICY "parts: admin manage all"
  ON public.parts_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ===== 20260729225835_6ef0875b-c295-489e-871b-af02a548d6a7.sql =====
REVOKE EXECUTE ON FUNCTION public.is_verified_dealer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_verified_dealer(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_verified_dealer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_dealer(uuid) TO service_role;


-- ===== 20260729225919_bcdf9a93-d55d-4780-8180-a80a12726a94.sql =====
DROP POLICY IF EXISTS "part_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "part_images_owner_update" ON storage.objects;

CREATE POLICY "part_images_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'part-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.is_verified_dealer(auth.uid())
    AND lower(name) ~ '\.(jpg|jpeg|png|webp|avif|gif)$'
  );

DROP POLICY IF EXISTS "part_images_owner_update" ON storage.objects;
CREATE POLICY "part_images_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'part-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'part-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.is_verified_dealer(auth.uid())
    AND lower(name) ~ '\.(jpg|jpeg|png|webp|avif|gif)$'
  );


-- ===== 20260729225932_f6883766-d07b-4213-9794-8a9135de8a35.sql =====
-- Demo seed rows: no dealer owns them. Guard against deleting anything ordered.
DELETE FROM public.parts_catalog p
WHERE p.supplier_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.part_order_items i WHERE i.part_id = p.id);

-- Fabricated normalized provider coordinates (Math.random at signup).
ALTER TABLE public.provider_details ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE public.provider_details ALTER COLUMN lng DROP NOT NULL;

UPDATE public.provider_details
SET lat = NULL, lng = NULL
WHERE (lat IS NOT NULL AND abs(lat) < 1) AND (lng IS NOT NULL AND abs(lng) < 1);


-- ===== 20260729230103_c199dfb9-ce99-4502-b703-eb89f8489577.sql =====
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS location_captured_at timestamptz;


-- ===== 20260729230713_9f9fd275-0488-457c-966d-ba94f600d68f.sql =====
-- Public browsing surface: catalogue + service packages only.
GRANT SELECT ON public.parts_catalog TO anon;
GRANT SELECT ON public.service_packages TO anon;

DROP POLICY IF EXISTS parts_read_anon ON public.parts_catalog;
CREATE POLICY parts_read_anon
  ON public.parts_catalog
  FOR SELECT
  TO anon
  USING (active = true);

DROP POLICY IF EXISTS packages_read_anon ON public.service_packages;
CREATE POLICY packages_read_anon
  ON public.service_packages
  FOR SELECT
  TO anon
  USING (true);


-- ===== 20260729232802_9c15c57f-cd8a-454c-b460-60f4b91af6b8.sql =====
-- ============ B) verified_providers ============
CREATE TABLE IF NOT EXISTS public.verified_providers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid,
  notes text
);

GRANT SELECT ON public.verified_providers TO authenticated;
GRANT ALL ON public.verified_providers TO service_role;

ALTER TABLE public.verified_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verified_providers: read own or admin" ON public.verified_providers;
CREATE POLICY "verified_providers: read own or admin"
  ON public.verified_providers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "verified_providers: admin insert" ON public.verified_providers;
CREATE POLICY "verified_providers: admin insert"
  ON public.verified_providers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "verified_providers: admin update" ON public.verified_providers;
CREATE POLICY "verified_providers: admin update"
  ON public.verified_providers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "verified_providers: admin delete" ON public.verified_providers;
CREATE POLICY "verified_providers: admin delete"
  ON public.verified_providers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Grandfather existing providers (insert only)
INSERT INTO public.verified_providers (user_id, notes)
SELECT pd.id, 'Grandfathered from provider_details (Pass A.1)'
FROM public.provider_details pd
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_verified_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.verified_providers vp WHERE vp.user_id = _user_id)
$$;

REVOKE ALL ON FUNCTION public.is_verified_provider(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_verified_provider(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_verified_provider(uuid) TO authenticated, service_role;

-- Collapse to a single INSERT policy on job_offers
DROP POLICY IF EXISTS "offers: providers insert on open jobs (role)" ON public.job_offers;
DROP POLICY IF EXISTS "offers: provider inserts own" ON public.job_offers;

CREATE POLICY "offers: provider inserts own"
  ON public.job_offers FOR INSERT TO authenticated
  WITH CHECK (
    provider_id = auth.uid()
    AND public.is_verified_provider(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.provider_details pd ON pd.id = auth.uid()
      WHERE j.id = job_offers.job_id
        AND j.status = 'Pending'::public.job_status
        AND j.service_type = pd.service_type
    )
  );

-- ============ C) INSERT-side role escalation ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_role public.user_role NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _requested public.user_role;
begin
  begin
    _requested := nullif(new.raw_user_meta_data->>'role','')::public.user_role;
  exception when others then
    _requested := null;
  end;

  insert into public.profiles (
    id, full_name, boat_name, role, requested_role,
    preferred_language, phone, account_type
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'boat_name',
    'Client'::public.user_role,
    case when _requested::text = 'Client' then null else _requested end,
    coalesce((new.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr'),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'account_type','')
  );
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.prevent_profile_insert_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.role := 'Client'::public.user_role;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_prevent_insert_priv_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_insert_priv_escalation
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_insert_privilege_escalation();

CREATE OR REPLACE FUNCTION public.approve_role_request(_user_id uuid, _role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
    SET role = _role, requested_role = NULL
    WHERE id = _user_id;

  IF _role::text = 'Provider' THEN
    INSERT INTO public.verified_providers (user_id, verified_by, notes)
      VALUES (_user_id, auth.uid(), 'Approved via approve_role_request')
      ON CONFLICT (user_id) DO NOTHING;
  ELSIF _role::text = 'Supplier' THEN
    INSERT INTO public.verified_dealers (user_id, verified_by, note)
      VALUES (_user_id, auth.uid(), 'Approved via approve_role_request')
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.approve_role_request(uuid, public.user_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_role_request(uuid, public.user_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_role_request(uuid, public.user_role) TO authenticated, service_role;

-- ============ D) complete_job returns jsonb ============
DROP FUNCTION IF EXISTS public.complete_job(uuid);

CREATE FUNCTION public.complete_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total numeric;
  commission numeric;
  payout numeric;
  prov uuid;
  _gross bigint;
  _fee bigint;
  _net bigint;
  _intent_id uuid;
  _commission_id uuid;
BEGIN
  SELECT total_escrow_pool, provider_id INTO total, prov
    FROM public.jobs
    WHERE id = _job_id
      AND client_id = auth.uid()
      AND status NOT IN ('Completed', 'Cancelled')
    FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.jobs WHERE id = _job_id AND client_id = auth.uid()) THEN
      RETURN jsonb_build_object('status', 'already_completed', 'job_id', _job_id);
    END IF;
    RAISE EXCEPTION 'Not authorized';
  END IF;

  commission := round(total * 0.10);
  payout := total - commission;

  UPDATE public.jobs SET status = 'Completed' WHERE id = _job_id;

  PERFORM set_config('thalvo.internal_wallet_credit', 'on', true);
  UPDATE public.profiles SET wallet_balance = wallet_balance + payout WHERE id = prov;
  PERFORM set_config('thalvo.internal_wallet_credit', 'off', true);

  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (_job_id, commission, payout);

  _gross := (round(total * 100))::bigint;
  _fee   := (round(commission * 100))::bigint;
  _net   := _gross - _fee;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured'
    ORDER BY created_at DESC LIMIT 1;

  IF _intent_id IS NOT NULL THEN
    UPDATE public.payment_intents
      SET status = 'released', released_at = now(), amount_cents = _gross
      WHERE id = _intent_id;

    INSERT INTO public.escrow_transactions(
      job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
    ) VALUES (
      _job_id, _intent_id, 'release', _gross, 'TRY', auth.uid(),
      'Captain confirmed mission completion'
    );
  END IF;

  INSERT INTO public.commission_records(
    job_id, payment_intent_id, gross_cents, fee_cents, net_cents, rate, currency
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'TRY')
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO _commission_id;

  IF _commission_id IS NULL THEN
    SELECT id INTO _commission_id FROM public.commission_records WHERE job_id = _job_id;
  END IF;

  IF prov IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.provider_payouts WHERE job_id = _job_id
  ) THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id, amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'TRY', 'pending');
  END IF;

  RETURN jsonb_build_object(
    'status', 'completed',
    'job_id', _job_id,
    'commission_id', _commission_id
  );
END $$;

REVOKE ALL ON FUNCTION public.complete_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_job(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO authenticated, service_role;

-- ============ E) public catalog guard ============
DROP POLICY IF EXISTS parts_read_anon ON public.parts_catalog;
CREATE POLICY parts_read_anon
  ON public.parts_catalog FOR SELECT TO anon
  USING (active = true AND supplier_id IS NOT NULL);


-- ===== 20260827075340_0f34e29a-aafe-494a-a802-10a0922c3169.sql =====
-- 1. Remove self-declared-role based open pool visibility
DROP POLICY IF EXISTS "jobs: providers read open pool (role)" ON public.jobs;

-- 2. Require admin-granted verification for open pool visibility
DROP POLICY IF EXISTS "jobs: providers read open pool" ON public.jobs;
CREATE POLICY "jobs: providers read open pool"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  status = 'Pending'::public.job_status
  AND public.is_verified_provider(auth.uid())
  AND public.provider_offers_service(auth.uid(), service_type)
);

-- 3. Trigger-only function must not be callable from the API
REVOKE ALL ON FUNCTION public.prevent_profile_insert_privilege_escalation() FROM PUBLIC, anon, authenticated;


-- ===== 20260905045602_2a48239d-dd18-49ad-93e3-93b0fb472046.sql =====
CREATE TABLE IF NOT EXISTS public.marine_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('marina','lighthouse','restaurant','hazard','anchorage','fuel')),
  name text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  vhf_channel text,
  depth_m numeric,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.marine_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marine_zones TO authenticated;
GRANT ALL ON public.marine_zones TO service_role;

ALTER TABLE public.marine_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marine_zones: public read active" ON public.marine_zones;
CREATE POLICY "marine_zones: public read active" ON public.marine_zones
  FOR SELECT TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS "marine_zones: admins read all" ON public.marine_zones;
CREATE POLICY "marine_zones: admins read all" ON public.marine_zones
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "marine_zones: admins insert" ON public.marine_zones;
CREATE POLICY "marine_zones: admins insert" ON public.marine_zones
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "marine_zones: admins update" ON public.marine_zones;
CREATE POLICY "marine_zones: admins update" ON public.marine_zones
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "marine_zones: admins delete" ON public.marine_zones;
CREATE POLICY "marine_zones: admins delete" ON public.marine_zones
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_marine_zones_updated
  BEFORE UPDATE ON public.marine_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('hazard','anchorage','restaurant','light_fault')),
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  depth_m numeric,
  seabed text CHECK (seabed IN ('sand','mud','weed','rock')),
  note text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_reports: public read approved" ON public.community_reports;
CREATE POLICY "community_reports: public read approved" ON public.community_reports
  FOR SELECT TO anon, authenticated USING (status = 'approved');
DROP POLICY IF EXISTS "community_reports: read own" ON public.community_reports;
CREATE POLICY "community_reports: read own" ON public.community_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS "community_reports: admins read all" ON public.community_reports;
CREATE POLICY "community_reports: admins read all" ON public.community_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "community_reports: insert own pending" ON public.community_reports;
CREATE POLICY "community_reports: insert own pending" ON public.community_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'pending_approval');
DROP POLICY IF EXISTS "community_reports: admins update" ON public.community_reports;
CREATE POLICY "community_reports: admins update" ON public.community_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "community_reports: admins delete" ON public.community_reports;
CREATE POLICY "community_reports: admins delete" ON public.community_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_community_reports_updated
  BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.marine_zones (kind, name, lat, lng, vhf_channel, depth_m, description) VALUES
  ('marina','D-Marin Göcek',36.7525,28.9428,'73',6,'Tam donanımlı marina, yakıt ve teknik servis mevcut.'),
  ('marina','Skopea Marina',36.7510,28.9400,'72',5,'Göcek merkezde, kısa süreli bağlama için uygun.'),
  ('fuel','Göcek Yakıt İskelesi',36.7485,28.9380,NULL,4,'Dizel ve benzin ikmali.'),
  ('anchorage','Bedri Rahmi Koyu',36.6983,28.8683,NULL,8,'Kum dip, iyi demir tutar. Kuzey rüzgarına kapalı.'),
  ('anchorage','Sarsala Koyu',36.6710,28.8550,NULL,10,'Geniş koy, çamur dip. Tonoz mevcut.'),
  ('hazard','Dökükbaşı Sığlığı',36.7380,28.9210,NULL,1.5,'1.5 metreden derin su çeken tekneler için tehlikeli. Geniş dolaşın.'),
  ('lighthouse','Kızılada Feneri',36.6210,28.9970,NULL,NULL,'Fethiye körfezi girişi, beyaz şimşekli fener.'),
  ('marina','Netsel Marmaris Marina',36.8480,28.2760,'72',7,'Marmaris merkez, tam hizmet marina.'),
  ('anchorage','Bozburun Limanı',36.6870,28.0430,NULL,9,'Rüzgardan korunaklı, çamur dip.');


-- ===== 20260905045700_aa935044-17bc-48df-9669-643ddf42275f.sql =====
DROP POLICY IF EXISTS "jobs: admins read all" ON public.jobs;
CREATE POLICY "jobs: admins read all" ON public.jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "jobs: admins update" ON public.jobs;
CREATE POLICY "jobs: admins update" ON public.jobs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ===== 20260905053437_b256e9ae-1826-489b-9d19-b5f95c7d6896.sql =====
CREATE OR REPLACE VIEW public.public_parts_catalog
WITH (security_barrier = true) AS
SELECT id, name, brand, category, sku, image_url, price, stock, compatibility, marina, created_at
FROM public.parts_catalog
WHERE active = true AND supplier_id IS NOT NULL;

GRANT SELECT ON public.public_parts_catalog TO anon;
GRANT SELECT ON public.public_parts_catalog TO authenticated;
GRANT ALL ON public.public_parts_catalog TO service_role;

DROP POLICY parts_read_anon ON public.parts_catalog;


-- ===== 20260905091500_3819832f-face-448e-815d-938a08e4f8d2.sql =====
-- Report Modal phase: allow anonymous captain advice submissions and add
-- the title / boat-name fields the new ReportModal collects.
--
-- `community_reports` already existed (see
-- 20260905045602_2a48239d-dd18-49ad-93e3-93b0fb472046.sql) with lat/lng,
-- depth_m, seabed and an auth-only reporter_id. We extend it in place
-- instead of creating a duplicate table with renamed columns, since the
-- admin approval desk, the marine chart popups and the marine-data helpers
-- already depend on those exact column names.

ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS submitted_by text;

-- Anonymous captains have no auth.uid(), so reporter_id can no longer be
-- mandatory. submitted_by (free-text name / boat name) is the optional
-- identification field for that case.
ALTER TABLE public.community_reports
  ALTER COLUMN reporter_id DROP NOT NULL;

-- Add the "general warning" category used by the new modal.
ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_category_check;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_category_check
  CHECK (category IN ('hazard','anchorage','restaurant','light_fault','general'));

-- Anonymous submissions need INSERT access; SELECT stays restricted to
-- admins and already-approved rows (see existing policies below).
GRANT INSERT ON public.community_reports TO anon;

DROP POLICY IF EXISTS "community_reports: insert own pending" ON public.community_reports;

DROP POLICY IF EXISTS "community_reports: authenticated insert pending" ON public.community_reports;
CREATE POLICY "community_reports: authenticated insert pending" ON public.community_reports
  FOR INSERT TO authenticated
  WITH CHECK (status = 'pending_approval' AND (reporter_id = auth.uid() OR reporter_id IS NULL));

DROP POLICY IF EXISTS "community_reports: anon insert pending" ON public.community_reports;
CREATE POLICY "community_reports: anon insert pending" ON public.community_reports
  FOR INSERT TO anon
  WITH CHECK (status = 'pending_approval' AND reporter_id IS NULL);


-- ===== 20260905093000_e7c1a2f4-6b3d-4a1e-9f2c-8d5e0b7a3c91.sql =====
-- Live Ops phase: the admin tower and every open chart now listen for
-- postgres_changes on these two tables (new captain advice, new/edited chart
-- points). `jobs` was already added to the realtime publication in
-- 20260701230657_896db2d8-a977-4293-ba9c-3ab8206b7779.sql; these were not.
--
-- RLS still governs what a given re-read can return — this only lets
-- clients know *when* to re-read. Anonymous sessions remain limited to
-- `active = true` zones and `status = 'approved'` reports (see
-- 20260905045602 and 20260905091500), so a realtime event about a still-
-- pending row cannot leak its contents to a non-admin subscriber.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'community_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reports;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'marine_zones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marine_zones;
  END IF;
END $$;


-- ===== 20260909044500_f2d8b6c1-9a34-4e07-b6a0-1c1a8b5e6f2a.sql =====
-- Navily-style seed: curated marinas, anchorages and one charted hazard
-- along the Turkish Aegean/Mediterranean coast (Didim -> Antalya).
--
-- The source INSERT this migration is derived from targets a
-- "category / latitude / longitude / max_depth / metadata" column shape.
-- `marine_zones` already exists (see 20260905045602) with kind / lat / lng /
-- depth_m and no `metadata` column. We extend the table additively — same
-- reasoning as 20260905091500 for community_reports — instead of renaming
-- the columns every existing query, popup, search bar and admin form
-- (marine-data.ts, LiveMap.tsx, ChartHud.tsx, AdminZoneDialog.tsx) already
-- depends on. Column ORDER below matches the source 1:1, so only the
-- column list header changed, not the value tuples.
ALTER TABLE public.marine_zones
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Lets `ON CONFLICT (name) DO NOTHING` make this (or a future reseed)
-- idempotent instead of accumulating duplicate pins on every re-run.
ALTER TABLE public.marine_zones
  DROP CONSTRAINT IF EXISTS marine_zones_name_key;
ALTER TABLE public.marine_zones
  ADD CONSTRAINT marine_zones_name_key UNIQUE (name);

INSERT INTO public.marine_zones (
  name,
  kind,
  lat,
  lng,
  vhf_channel,
  depth_m,
  description,
  metadata
)
VALUES
  -- 1. DİDİM & GÜLLÜK KÖRFEZİ
  ('D-Marin Didim', 'marina', 37.3372, 27.2608, '72', 15.0, 'Resmi giriş limanı, tam donanımlı marina ve çekek sahası.', '{"bottom": "çamur", "protection": "tam", "amenities": ["yakıt", "su", "elektrik", "lift"]}'),
  ('Panayır Adası Demir Yeri', 'anchorage', 37.3290, 27.3280, NULL, 8.0, 'Melteme açık günlerde korunaklı demirleme noktası.', '{"bottom": "kum", "protection": "kuzey_korunakli"}'),
  ('Iassos (Kıyıkışlacık)', 'anchorage', 37.2795, 27.5780, NULL, 6.0, 'Tarihi liman, batı ve kuzey rüzgarlarına tam kapalı güvenli havuz.', '{"bottom": "çamur", "protection": "tam"}'),

  -- 2. BODRUM YARIMADASI & GÖKOVA
  ('Yalıkavak Marina', 'marina', 37.1065, 27.2885, '62 / 16', 14.0, 'Süperyat marinası, lüks mağazalar ve teknik servis.', '{"bottom": "çamur", "protection": "tam", "amenities": ["yakıt", "gümrük", "helipad"]}'),
  ('Turgutreis D-Marin', 'marina', 37.0015, 27.2580, '73', 8.0, 'Güney Ege çıkış limanı, Kos adası karşısı.', '{"bottom": "kum", "protection": "tam"}'),
  ('Bodrum Milta Marina', 'marina', 37.0345, 27.4240, '73 / 16', 6.0, 'Bodrum Kalesi yanı, şehir içi tarihi marina.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Çökertme Koyu', 'anchorage', 37.0010, 27.7915, NULL, 10.0, 'Gökova girişi, batıda tonozlar ve restoran iskeleleri.', '{"bottom": "kum-erişte", "protection": "kuzey_korunakli"}'),
  ('İngiliz Limanı (Değirmenbükü)', 'anchorage', 36.9315, 28.1480, NULL, 12.0, 'Gökova''nın en korunaklı doğal limanlarından biri, çam ağaçlarına koltuk alma.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Sedir Adası (Kleopatra)', 'anchorage', 36.9930, 28.2040, NULL, 7.0, 'Gündüz demirleme alanı, tarihi plaj ve antik kalıntılar.', '{"bottom": "kum", "protection": "orta"}'),

  -- 3. DATÇA & HİSARÖNÜ KÖRFEZİ
  ('Knidos Antik Limanı', 'anchorage', 36.6855, 27.3750, NULL, 6.0, 'Güney limanı batı ve kuzey rüzgarlarına kapalıdır, mendirek içi dar alan.', '{"bottom": "kum-taş", "protection": "guney_haric_iyi"}'),
  ('Palamutbükü Limanı', 'marina', 36.6710, 27.5050, NULL, 4.0, 'Belediye iskelesi ve geniş kumsal önü demirleme alanı.', '{"bottom": "kum", "protection": "orta"}'),
  ('Datça Şehir Limanı', 'marina', 36.7215, 27.6890, '16', 5.0, 'Belediye yat limanı, gümrük noktası.', '{"bottom": "kum-erişte", "protection": "kuzey_korunakli"}'),
  ('Dirsekbükü', 'anchorage', 36.6870, 27.9820, NULL, 12.0, 'Hisarönü Körfezi''nin en güvenli koyu, her havaya kapalı doğal liman.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Selimiye Koyu', 'anchorage', 36.7075, 28.0930, NULL, 15.0, 'Restoran iskeleleri, tonozlar ve korunaklı iç deniz yapısı.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Bozburun Limanı', 'marina', 36.6890, 28.0430, '16', 6.0, 'Yat imalat merkezi, gümrük giriş kapısı ve geniş koy.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Söğüt Limanı', 'anchorage', 36.6570, 28.0825, NULL, 10.0, 'Geniş demir yeri, taze balık restoranları ve tonozlar.', '{"bottom": "kum-erişte", "protection": "orta"}'),
  ('Bozukkale (Loryma)', 'anchorage', 36.5670, 28.0125, NULL, 11.0, 'Rodos boğazı çıkışı, antik kale surları altında güvenli sığınak.', '{"bottom": "kum-erişte", "protection": "tam"}'),

  -- 4. MARMARİS & EKİNCİK
  ('Netsel Marina Marmaris', 'marina', 36.8525, 28.2780, '72 / 16', 18.0, 'Bölgenin ana merkez marinası, mega yat bağlama ve teknik servis.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Çiftlik Koyu', 'anchorage', 36.7160, 28.2430, NULL, 10.0, 'Geniş çakıl plaj önü, restoran tonozları, güney havalarına dikkat edilmeli.', '{"bottom": "kum-çakıl", "protection": "kuzey_korunakli"}'),
  ('Ekincik Koyu (My Marina)', 'anchorage', 36.8220, 28.5520, NULL, 14.0, 'Dalyan/Kaunos geçişi öncesi korunaklı mola koyu.', '{"bottom": "kum", "protection": "iyi"}'),

  -- 5. GÖCEK & FETHİYE KÖRFEZİ
  ('D-Marin Göcek', 'marina', 36.7525, 28.9428, '73', 12.0, 'Lüks yat marinası, mavi bayraklı plaj ve teknik altyapı.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Göcek Yakıt İskelesi', 'marina', 36.7485, 28.9380, '16 / 72', 9.0, 'Bölgenin ana deniz yakıt ikmal istasyonu.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Bedri Rahmi Koyu', 'anchorage', 36.6983, 28.8683, NULL, 14.0, 'Tarihi kaya mezarları, balık figürlü kaya ve korunaklı tonozlar.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Sarsala Koyu', 'anchorage', 36.6710, 28.8550, NULL, 12.0, 'Güney Göcek havzası, çam ağaçlarına koltuk alma imkanı.', '{"bottom": "kum-çamur", "protection": "tam"}'),
  ('Göbün Koyu', 'anchorage', 36.6490, 28.8950, NULL, 8.0, 'Dar girişli, fırtınaya kapalı saklı havuz.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Dökükbaşı Sığlığı', 'hazard', 36.7250, 28.9210, NULL, 1.2, 'Seyir tehlikesi! Min derinlik 1.2m resif kayalığı.', '{"bottom": "kaya", "hazard_type": "reef"}'),
  ('Fethiye Ece Marina', 'marina', 36.6260, 29.1020, '73', 10.0, 'Şehir merkezi bağlantılı modern marina.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Ölüdeniz Soğuksu Koyu', 'anchorage', 36.5490, 29.1170, NULL, 12.0, 'Kayaköy arkası, tatlı su kaynakları ve berrak dip yapısı.', '{"bottom": "kum-kaya", "protection": "kuzey_korunakli"}'),

  -- 6. KALKAN, KAŞ & KEKOVA
  ('Kalkan Şehir İskelesi', 'marina', 36.2625, 29.4160, '16', 5.0, 'Tarihi kasaba içi bağlama iskelesi.', '{"bottom": "kum", "protection": "orta"}'),
  ('Kaş Setur Marina', 'marina', 36.2045, 29.6260, '73', 15.0, 'Modern marina, Meis adası geçiş kapısı ve teknik servis.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Kastellorizo (Meis) Demir Yeri', 'anchorage', 36.1490, 29.5930, NULL, 8.0, 'Kaş açığı liman önü sığınağı.', '{"bottom": "kum-erişte", "protection": "kuzey_korunakli"}'),
  ('Kekova Batık Şehir & Kaleköy (Simena)', 'anchorage', 36.1910, 29.8620, NULL, 10.0, 'Tarihi lahitler yanı, doğal dalgakıran oluşturan ada arkası.', '{"bottom": "kum-çamur", "protection": "tam"}'),
  ('Üçağız Limanı', 'anchorage', 36.1970, 29.8485, NULL, 5.0, 'Kekova iç denizi, her yöne kapalı tam güvenli çamur havuz.', '{"bottom": "çamur", "protection": "tam"}'),

  -- 7. FİNİKE & ANTALYA KÖRFEZİ
  ('Setur Finike Marina', 'marina', 36.2950, 30.1500, '73', 8.0, 'Akdeniz kışlama merkezi, gümrük giriş kapısı.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Ceneviz Limanı (Porto Genoese)', 'anchorage', 36.3530, 30.4720, NULL, 14.0, 'Musa Dağı eteği, turkuaz su, güney hariç korunaklı vahşi koy.', '{"bottom": "kum", "protection": "kuzey_korunakli"}'),
  ('Phaselis Antik Koyu', 'anchorage', 36.5240, 30.5530, NULL, 6.0, 'Tarihi su kemerleri önü kuzey ve güney limanları.', '{"bottom": "kum", "protection": "orta"}'),
  ('G-Marina Kemer', 'marina', 36.6010, 30.5690, '73', 6.0, 'Antalya körfezi batı girişi marinası.', '{"bottom": "kum", "protection": "tam"}'),
  ('Setur Antalya Marina (Büyük Liman)', 'marina', 36.8335, 30.6080, '73 / 16', 10.0, 'Körfezin ana korunaklı limanı ve çekek sahası.', '{"bottom": "çamur", "protection": "tam"}'),
  ('Kaleiçi Yat Limanı (Antalya)', 'marina', 36.8845, 30.7025, '16', 4.5, 'Tarihi surlar içi nostaljik yat limanı.', '{"bottom": "kum-kaya", "protection": "orta"}')
ON CONFLICT (name) DO NOTHING;


-- ===== 20260909083000_security_hardening.sql =====
-- Static security audit follow-up (2026-09-09):
-- 1) Drop leftover simulation GRANTs on profiles/jobs for anon.
-- 2) Constrain community_reports payloads (length, coords, fuel category).
-- 3) Block direct client UPDATE of job money / assignment / status columns.
-- 4) Bound add_extra_part name/price; reject accept_offer if escrow already exists.

-- ---------------------------------------------------------------------------
-- 1. Anon must not write profiles or jobs (RLS already dropped simulation
--    policies; these GRANTs were leftover from the same simulation pass).
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.jobs FROM anon;
REVOKE SELECT ON public.jobs FROM anon;

-- ---------------------------------------------------------------------------
-- 2. community_reports: category + payload bounds
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_category_check;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_category_check
  CHECK (category IN ('hazard','anchorage','restaurant','light_fault','general','fuel'));

ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_note_len;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_note_len
  CHECK (char_length(coalesce(note, '')) <= 1000);

ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_title_len;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_title_len
  CHECK (char_length(coalesce(title, '')) <= 160);

ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_submitted_by_len;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_submitted_by_len
  CHECK (char_length(coalesce(submitted_by, '')) <= 80);

ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_latlng_bounds;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_latlng_bounds
  CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);

-- ---------------------------------------------------------------------------
-- 3. Jobs: financial / assignment / status are RPC-only for non-admin clients.
--    SECURITY DEFINER RPCs run as the function owner (postgres), so
--    current_user <> 'authenticated' and this trigger is a no-op for them.
--    Admins keep a direct UPDATE path used by the ops desk.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_job_direct_tamper()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
     OR NEW.initial_labor_cost IS DISTINCT FROM OLD.initial_labor_cost
     OR NEW.extra_parts_cost IS DISTINCT FROM OLD.extra_parts_cost
     OR NEW.total_escrow_pool IS DISTINCT FROM OLD.total_escrow_pool
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.eta_minutes IS DISTINCT FROM OLD.eta_minutes
  THEN
    RAISE EXCEPTION 'Job assignment and financial fields are RPC-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_prevent_direct_tamper ON public.jobs;
CREATE TRIGGER jobs_prevent_direct_tamper
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.prevent_job_direct_tamper();

REVOKE ALL ON FUNCTION public.prevent_job_direct_tamper() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. add_extra_part: name length + price range (mirrors job_parts CHECK)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_extra_part(
  _job_id uuid, _name text, _price numeric, _photo text, _source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _id uuid;
begin
  if _price is null or _price <= 0 or _price > 1000000 then
    raise exception 'Invalid part price';
  end if;
  if char_length(trim(coalesce(_name, ''))) < 1 or char_length(_name) > 200 then
    raise exception 'Invalid part name';
  end if;
  if not exists (select 1 from public.jobs where id=_job_id and provider_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  insert into public.job_parts(job_id, part_name, part_price, part_image_url, source)
    values (
      _job_id,
      left(trim(_name), 200),
      _price,
      _photo,
      left(coalesce(_source, 'Tedarikçi Firma (Local Supplier)'), 120)
    )
    returning id into _id;
  update public.jobs set status='PartsPending'::public.job_status where id=_job_id;
  return _id;
end
$function$;

REVOKE ALL ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. accept_offer: refuse if a secured/released escrow already exists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_offer(_job_id uuid, _offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare o public.job_offers%rowtype;
begin
  select * into o from public.job_offers where id = _offer_id and job_id = _job_id;
  if not found then raise exception 'Offer not found'; end if;
  if exists (
    select 1 from public.payment_intents
    where job_id = _job_id and status in ('secured', 'released')
  ) then
    raise exception 'Job already funded';
  end if;
  update public.jobs
    set provider_id = o.provider_id,
        initial_labor_cost = o.price,
        total_escrow_pool = o.price,
        eta_minutes = o.eta_minutes,
        status = 'Accepted'
    where id = _job_id
      and client_id = auth.uid()
      and status in ('Pending', 'Offered');
  if not found then raise exception 'Not authorized'; end if;
end
$function$;

REVOKE ALL ON FUNCTION public.accept_offer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Jobs INSERT: captains may only open unassigned Pending jobs with zero
--    escrow. Direct insert of provider_id / Accepted / costs was an IDOR
--    (any captain could assign any provider and invent escrow). Package
--    booking goes through book_service_package() below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_job_insert_tamper()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.client_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot create a job for another captain';
  END IF;
  IF NEW.provider_id IS NOT NULL
     OR NEW.status IS DISTINCT FROM 'Pending'
     OR coalesce(NEW.initial_labor_cost, 0) <> 0
     OR coalesce(NEW.extra_parts_cost, 0) <> 0
     OR coalesce(NEW.total_escrow_pool, 0) <> 0
  THEN
    RAISE EXCEPTION 'Job assignment and escrow must go through RPCs';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_prevent_insert_tamper ON public.jobs;
CREATE TRIGGER jobs_prevent_insert_tamper
BEFORE INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.prevent_job_insert_tamper();

REVOKE ALL ON FUNCTION public.prevent_job_insert_tamper() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "jobs: client inserts" ON public.jobs;
CREATE POLICY "jobs: client inserts" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND provider_id IS NULL
    AND status = 'Pending'
    AND initial_labor_cost = 0
    AND extra_parts_cost = 0
    AND total_escrow_pool = 0
  );

CREATE OR REPLACE FUNCTION public.book_service_package(
  _psp_id uuid,
  _lat numeric,
  _lng numeric,
  _marina text,
  _description text,
  _location_accuracy_m numeric DEFAULT NULL,
  _location_captured_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  psp public.provider_service_packages%rowtype;
  pkg public.service_packages%rowtype;
  _id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;
  if _lat is null or _lng is null or _lat < -90 or _lat > 90 or _lng < -180 or _lng > 180 then
    raise exception 'Invalid coordinates';
  end if;
  select * into psp from public.provider_service_packages where id = _psp_id;
  if not found then raise exception 'Offer not found'; end if;
  if psp.price is null or psp.price <= 0 or psp.price > 1000000 then
    raise exception 'Invalid package price';
  end if;
  select * into pkg from public.service_packages where id = psp.package_id;
  if not found then raise exception 'Package not found'; end if;

  insert into public.jobs (
    client_id, provider_id, service_type, problem_category, description,
    lat, lng, marina, status, initial_labor_cost, extra_parts_cost,
    total_escrow_pool, eta_minutes, location_accuracy_m, location_captured_at
  ) values (
    auth.uid(),
    psp.provider_id,
    case when pkg.category = 'diver' then 'Underwater Diver'::public.service_type
         else 'Marine Mechanic'::public.service_type end,
    pkg.key,
    left(coalesce(_description, ''), 400),
    _lat, _lng,
    left(coalesce(nullif(trim(_marina), ''), 'Göcek'), 80),
    'Accepted',
    psp.price,
    0,
    psp.price,
    psp.eta_minutes,
    _location_accuracy_m,
    _location_captured_at
  ) returning id into _id;
  return _id;
end
$function$;

REVOKE ALL ON FUNCTION public.book_service_package(uuid, numeric, numeric, text, text, numeric, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_service_package(uuid, numeric, numeric, text, text, numeric, timestamptz)
  TO authenticated;


-- ===== 20260909084500_emergency_service_requests.sql =====
-- Role-based emergency service & diver call network.
-- Captains insert pending calls; providers accept via SECURITY DEFINER RPC.

CREATE TABLE IF NOT EXISTS public.emergency_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vessel_name text NOT NULL DEFAULT '',
  category text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  bay_name text,
  description text NOT NULL DEFAULT '',
  urgency_level text NOT NULL DEFAULT 'urgent',
  assigned_provider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emergency_service_requests_category_check
    CHECK (category IN ('diver', 'mechanic', 'electrician', 'towing')),
  CONSTRAINT emergency_service_requests_urgency_check
    CHECK (urgency_level IN ('urgent', 'standard')),
  CONSTRAINT emergency_service_requests_status_check
    CHECK (status IN ('pending', 'en_route', 'on_scene', 'completed')),
  CONSTRAINT emergency_service_requests_latlng_bounds
    CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180),
  CONSTRAINT emergency_service_requests_vessel_len
    CHECK (char_length(vessel_name) <= 80),
  CONSTRAINT emergency_service_requests_bay_len
    CHECK (char_length(coalesce(bay_name, '')) <= 120),
  CONSTRAINT emergency_service_requests_desc_len
    CHECK (char_length(description) <= 2000)
);

CREATE INDEX IF NOT EXISTS emergency_service_requests_status_idx
  ON public.emergency_service_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS emergency_service_requests_user_idx
  ON public.emergency_service_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS emergency_service_requests_provider_idx
  ON public.emergency_service_requests (assigned_provider_id, status);

ALTER TABLE public.emergency_service_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.emergency_service_requests TO authenticated;
GRANT ALL ON public.emergency_service_requests TO service_role;

DROP POLICY IF EXISTS "esr: insert own pending" ON public.emergency_service_requests;
CREATE POLICY "esr: insert own pending" ON public.emergency_service_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND assigned_provider_id IS NULL
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "esr: read own" ON public.emergency_service_requests;
CREATE POLICY "esr: read own" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "esr: providers read pending" ON public.emergency_service_requests;
CREATE POLICY "esr: providers read pending" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'Provider'
    )
  );

DROP POLICY IF EXISTS "esr: assigned provider read" ON public.emergency_service_requests;
CREATE POLICY "esr: assigned provider read" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (assigned_provider_id = auth.uid());

DROP POLICY IF EXISTS "esr: admins read all" ON public.emergency_service_requests;
CREATE POLICY "esr: admins read all" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.accept_emergency_request(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'Provider'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.emergency_service_requests
    SET assigned_provider_id = auth.uid(),
        status = 'en_route'
    WHERE id = _id
      AND status = 'pending'
      AND assigned_provider_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call already taken or not found';
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.accept_emergency_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_emergency_request(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'emergency_service_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_service_requests;
  END IF;
END $$;
