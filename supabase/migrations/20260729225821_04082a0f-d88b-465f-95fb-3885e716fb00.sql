CREATE TABLE public.verified_dealers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.verified_dealers TO authenticated;
GRANT ALL ON public.verified_dealers TO service_role;

ALTER TABLE public.verified_dealers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verified_dealers: read own or admin"
  ON public.verified_dealers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "verified_dealers: admin insert"
  ON public.verified_dealers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "verified_dealers: admin update"
  ON public.verified_dealers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

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

CREATE POLICY "parts: verified dealer manage own"
  ON public.parts_catalog FOR ALL TO authenticated
  USING (supplier_id = auth.uid() AND public.is_verified_dealer(auth.uid()))
  WITH CHECK (supplier_id = auth.uid() AND public.is_verified_dealer(auth.uid()));

CREATE POLICY "parts: admin manage all"
  ON public.parts_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));