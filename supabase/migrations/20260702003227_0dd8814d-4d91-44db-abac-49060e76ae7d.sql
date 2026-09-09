
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
