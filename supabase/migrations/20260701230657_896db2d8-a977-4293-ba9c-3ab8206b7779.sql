
-- =========================================
-- ENUMS
-- =========================================
create type public.app_role as enum ('admin', 'user');
create type public.user_role as enum ('Client', 'Provider');
create type public.service_type as enum ('Marine Mechanic', 'Underwater Diver');
create type public.provider_status as enum ('Available', 'Busy', 'Offline');
create type public.job_status as enum ('Pending','Offered','Accepted','EnRoute','OnSite','PartsPending','InProgress','Completed','Cancelled');
create type public.part_status as enum ('Pending','Paid','Rejected');
create type public.language_code as enum ('tr','en');

-- =========================================
-- PROFILES
-- =========================================
create table public.profiles (
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
create policy "Profiles: read all authed" on public.profiles for select to authenticated using (true);
create policy "Profiles: insert self"   on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Profiles: update self"   on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- =========================================
-- USER ROLES (admin flag)
-- =========================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles: read self" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

-- =========================================
-- PROVIDER DETAILS
-- =========================================
create table public.provider_details (
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
create policy "providers: readable by all authed" on public.provider_details for select to authenticated using (true);
create policy "providers: manage own" on public.provider_details for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- =========================================
-- JOBS
-- =========================================
create table public.jobs (
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
create policy "jobs: client reads own" on public.jobs for select to authenticated using (client_id = auth.uid());
create policy "jobs: provider reads assigned" on public.jobs for select to authenticated using (provider_id = auth.uid());
create policy "jobs: providers read open pool" on public.jobs
  for select to authenticated
  using (
    status = 'Pending'
    and exists (
      select 1 from public.provider_details pd
      where pd.id = auth.uid() and pd.service_type = jobs.service_type
    )
  );
create policy "jobs: client inserts" on public.jobs for insert to authenticated
  with check (client_id = auth.uid());
create policy "jobs: client or provider update" on public.jobs for update to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid())
  with check (client_id = auth.uid() or provider_id = auth.uid());

-- =========================================
-- JOB OFFERS
-- =========================================
create table public.job_offers (
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
create policy "offers: participants read" on public.job_offers for select to authenticated
  using (
    provider_id = auth.uid()
    or exists (select 1 from public.jobs j where j.id = job_id and j.client_id = auth.uid())
  );
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
create table public.job_parts (
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
create policy "parts: participants read" on public.job_parts for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));
create policy "parts: provider inserts" on public.job_parts for insert to authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.provider_id = auth.uid()));
create policy "parts: participants update" on public.job_parts for update to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));

-- =========================================
-- CHAT
-- =========================================
create table public.job_messages (
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
create policy "msgs: participants read" on public.job_messages for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));
create policy "msgs: participants insert" on public.job_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid()))
  );

-- =========================================
-- PLATFORM LEDGER
-- =========================================
create table public.platform_ledger (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  commission_amount numeric not null,
  provider_payout numeric not null,
  created_at timestamptz not null default now()
);
grant select on public.platform_ledger to authenticated;
grant all on public.platform_ledger to service_role;
alter table public.platform_ledger enable row level security;
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
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.job_offers;
alter publication supabase_realtime add table public.job_parts;
alter publication supabase_realtime add table public.job_messages;
alter publication supabase_realtime add table public.provider_details;
