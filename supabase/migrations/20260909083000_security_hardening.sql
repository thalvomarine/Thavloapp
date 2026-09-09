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
