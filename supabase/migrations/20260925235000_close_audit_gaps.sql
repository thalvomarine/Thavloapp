-- Close the audit gaps that are not the payment simulator or the legal pages.
-- Phone leaves the shared profile row. Public stock is a band. Anonymous chart
-- notes stop. Technician pins are coarse unless the viewer is on that job.
-- Captain AI is quota-limited. Boat listings and the document vault are real tables.

-- ---------------------------------------------------------------------------
-- 1. Phone is not a column job partners can read
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_contacts: read own or admin" ON public.profile_contacts;
CREATE POLICY "profile_contacts: read own or admin"
  ON public.profile_contacts FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profile_contacts: insert own" ON public.profile_contacts;
CREATE POLICY "profile_contacts: insert own"
  ON public.profile_contacts FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profile_contacts: update own or admin" ON public.profile_contacts;
CREATE POLICY "profile_contacts: update own or admin"
  ON public.profile_contacts FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.profile_contacts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.profile_contacts TO authenticated;
GRANT ALL ON public.profile_contacts TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    INSERT INTO public.profile_contacts (id, phone)
    SELECT id, phone
    FROM public.profiles
    WHERE phone IS NOT NULL AND btrim(phone) <> ''
    ON CONFLICT (id) DO UPDATE
      SET phone = EXCLUDED.phone, updated_at = now();
  END IF;
END $$;

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
    preferred_language, account_type
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'boat_name',
    'Client'::public.user_role,
    case when _requested = 'Client'::public.user_role then null else _requested end,
    coalesce((new.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr'),
    nullif(new.raw_user_meta_data->>'account_type','')
  );

  insert into public.profile_contacts (id, phone)
  values (new.id, nullif(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do update
    set phone = excluded.phone, updated_at = now();

  return new;
end $$;

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
SET search_path = public
AS $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.role, coalesce(c.phone, ''), u.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.profile_contacts c on c.id = p.id
    order by u.created_at desc;
end $$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated, service_role;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- ---------------------------------------------------------------------------
-- 2. Public catalogue exposes a stock band, not a count
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.public_parts_catalog;
CREATE VIEW public.public_parts_catalog
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  id,
  name,
  brand,
  category,
  sku,
  image_url,
  price,
  CASE
    WHEN stock <= 0 THEN 'out'
    WHEN stock <= 2 THEN 'low'
    ELSE 'in'
  END AS stock_band,
  compatibility,
  marina,
  created_at
FROM public.parts_catalog
WHERE active = true AND supplier_id IS NOT NULL;

GRANT SELECT ON public.public_parts_catalog TO anon, authenticated;
GRANT ALL ON public.public_parts_catalog TO service_role;
REVOKE SELECT ON public.parts_catalog FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Chart notes require an account. Approved rows stay public.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "community_reports: anon insert pending" ON public.community_reports;
REVOKE INSERT ON public.community_reports FROM anon;

DROP POLICY IF EXISTS "community_reports: authenticated insert pending" ON public.community_reports;
CREATE POLICY "community_reports: authenticated insert pending"
  ON public.community_reports FOR INSERT TO authenticated
  WITH CHECK (status = 'pending_approval' AND reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Exact technician GPS only for self, admin, or an active job client
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "provider_details: scoped read" ON public.provider_details;
CREATE POLICY "provider_details: scoped read"
  ON public.provider_details FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.user_is_job_participant_with(provider_details.id)
  );

-- Owner-executed so captains can see on-duty pins without a raw-table read.
-- Coordinates are rounded to ~1 km unless the viewer is that provider, an
-- admin, or the client of an open job with them.
CREATE OR REPLACE VIEW public.provider_live_pins
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  pd.id,
  pd.service_type,
  p.full_name,
  pd.live_status,
  CASE
    WHEN pd.id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.provider_id = pd.id
          AND j.client_id = auth.uid()
          AND j.status NOT IN ('Completed'::public.job_status, 'Cancelled'::public.job_status)
      )
    THEN pd.lat
    ELSE round(pd.lat::numeric, 2)::double precision
  END AS lat,
  CASE
    WHEN pd.id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.provider_id = pd.id
          AND j.client_id = auth.uid()
          AND j.status NOT IN ('Completed'::public.job_status, 'Cancelled'::public.job_status)
      )
    THEN pd.lng
    ELSE round(pd.lng::numeric, 2)::double precision
  END AS lng
FROM public.provider_details pd
LEFT JOIN public.profiles p ON p.id = pd.id
WHERE pd.live_status = 'Available'
  AND pd.lat IS NOT NULL
  AND pd.lng IS NOT NULL;

REVOKE ALL ON public.provider_live_pins FROM PUBLIC, anon;
GRANT SELECT ON public.provider_live_pins TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Captain AI quota: 8 calls / 10 minutes / user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_request_log_user_time_idx
  ON public.ai_request_log (user_id, created_at DESC);

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_request_log TO service_role;

CREATE OR REPLACE FUNCTION public.consume_captain_ai_quota()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  DELETE FROM public.ai_request_log
  WHERE user_id = auth.uid()
    AND created_at < now() - interval '1 hour';

  SELECT count(*)::int INTO n
  FROM public.ai_request_log
  WHERE user_id = auth.uid()
    AND created_at > now() - interval '10 minutes';

  IF n >= 8 THEN
    RAISE EXCEPTION 'ai_rate_limited';
  END IF;

  INSERT INTO public.ai_request_log (user_id) VALUES (auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.consume_captain_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_captain_ai_quota() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Shared boat listings (authenticated). Paused rows stay with the owner.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.https_photo_list_ok(_urls text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _urls IS NOT NULL
    AND cardinality(_urls) <= 6
    AND NOT EXISTS (
      SELECT 1 FROM unnest(_urls) AS url
      WHERE url IS NULL
        OR char_length(url) > 500
        OR url !~ '^https://'
    );
$$;

REVOKE ALL ON FUNCTION public.https_photo_list_ok(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.https_photo_list_ok(text[]) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.boat_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  year int NOT NULL CHECK (year BETWEEN 1950 AND 2100),
  price numeric NOT NULL CHECK (price >= 0 AND price <= 100000000),
  currency text NOT NULL CHECK (currency IN ('EUR', 'USD', 'TRY')),
  marina text NOT NULL CHECK (char_length(marina) BETWEEN 2 AND 80),
  region text NOT NULL CHECK (char_length(region) BETWEEN 2 AND 80),
  hull text NOT NULL CHECK (hull IN ('sail', 'motor', 'catamaran', 'rib')),
  loa_m numeric NOT NULL CHECK (loa_m > 0 AND loa_m < 200),
  beam_m numeric NOT NULL DEFAULT 0 CHECK (beam_m >= 0 AND beam_m < 40),
  draft_m numeric NOT NULL DEFAULT 0 CHECK (draft_m >= 0 AND draft_m < 20),
  engine_brand text NOT NULL DEFAULT '',
  engine_hp int NOT NULL DEFAULT 0 CHECK (engine_hp >= 0 AND engine_hp < 20000),
  engine_hours int NOT NULL DEFAULT 0 CHECK (engine_hours >= 0 AND engine_hours < 200000),
  fuel text NOT NULL CHECK (fuel IN ('diesel', 'petrol')),
  flag text NOT NULL DEFAULT '',
  cabins int NOT NULL DEFAULT 0 CHECK (cabins >= 0 AND cabins < 40),
  berths int NOT NULL DEFAULT 0 CHECK (berths >= 0 AND berths < 40),
  cruise_kn numeric NOT NULL DEFAULT 0 CHECK (cruise_kn >= 0 AND cruise_kn < 80),
  fuel_tank_l numeric CHECK (fuel_tank_l IS NULL OR (fuel_tank_l >= 0 AND fuel_tank_l < 100000)),
  water_tank_l numeric CHECK (water_tank_l IS NULL OR (water_tank_l >= 0 AND water_tank_l < 100000)),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  equipment text[] NOT NULL DEFAULT '{}',
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  seller_name text NOT NULL CHECK (char_length(seller_name) BETWEEN 1 AND 80),
  seller_phone text NOT NULL CHECK (char_length(seller_phone) BETWEEN 8 AND 24),
  hue text NOT NULL DEFAULT 'navy' CHECK (hue IN ('navy', 'teal', 'gold', 'slate', 'wine')),
  photos text[] NOT NULL DEFAULT '{}' CHECK (public.https_photo_list_ok(photos)),
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boat_listings_status_idx ON public.boat_listings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS boat_listings_owner_idx ON public.boat_listings (owner_id);

CREATE OR REPLACE FUNCTION public.touch_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_row_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_row_updated_at() TO authenticated, service_role;

DROP TRIGGER IF EXISTS boat_listings_touch ON public.boat_listings;
CREATE TRIGGER boat_listings_touch
  BEFORE UPDATE ON public.boat_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_row_updated_at();

ALTER TABLE public.boat_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boat_listings: read live or own" ON public.boat_listings;
CREATE POLICY "boat_listings: read live or own"
  ON public.boat_listings FOR SELECT TO authenticated
  USING (
    status = 'live'
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "boat_listings: insert own" ON public.boat_listings;
CREATE POLICY "boat_listings: insert own"
  ON public.boat_listings FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "boat_listings: update own" ON public.boat_listings;
CREATE POLICY "boat_listings: update own"
  ON public.boat_listings FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "boat_listings: delete own" ON public.boat_listings;
CREATE POLICY "boat_listings: delete own"
  ON public.boat_listings FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.boat_listings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boat_listings TO authenticated;
GRANT ALL ON public.boat_listings TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Private vessel document vault
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vessel_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('registration', 'insurance', 'transit_log', 'survey')),
  storage_path text NOT NULL CHECK (
    char_length(storage_path) BETWEEN 8 AND 300
    AND storage_path LIKE (owner_id::text || '/%')
    AND storage_path !~ '\.\.'
  ),
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 180),
  mime text NOT NULL CHECK (mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  byte_size int NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slot)
);

ALTER TABLE public.vessel_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vessel_documents: owner all" ON public.vessel_documents;
CREATE POLICY "vessel_documents: owner all"
  ON public.vessel_documents FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "vessel_documents: admin read" ON public.vessel_documents;
CREATE POLICY "vessel_documents: admin read"
  ON public.vessel_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.vessel_documents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vessel_documents TO authenticated;
GRANT ALL ON public.vessel_documents TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vessel-documents',
  'vessel-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "vessel_docs_owner_select" ON storage.objects;
CREATE POLICY "vessel_docs_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vessel-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vessel_docs_owner_insert" ON storage.objects;
CREATE POLICY "vessel_docs_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vessel-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vessel_docs_owner_update" ON storage.objects;
CREATE POLICY "vessel_docs_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vessel-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'vessel-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vessel_docs_owner_delete" ON storage.objects;
CREATE POLICY "vessel_docs_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vessel-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
