-- Boat-show / partner lead capture for QR landing (/boatshow).
-- Anon may insert only. Reads stay admin/service_role.

CREATE TABLE IF NOT EXISTS public.boatshow_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  company text,
  phone text NOT NULL,
  email text,
  kind text NOT NULL CHECK (kind IN ('brand', 'dealer', 'marina', 'captain', 'technician', 'other')),
  note text,
  source text NOT NULL DEFAULT 'boatshow'
);

ALTER TABLE public.boatshow_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boatshow_leads: anon insert" ON public.boatshow_leads;
CREATE POLICY "boatshow_leads: anon insert"
  ON public.boatshow_leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "boatshow_leads: admin read" ON public.boatshow_leads;
CREATE POLICY "boatshow_leads: admin read"
  ON public.boatshow_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.boatshow_leads FROM PUBLIC;
GRANT INSERT ON public.boatshow_leads TO anon, authenticated;
GRANT SELECT ON public.boatshow_leads TO authenticated;
GRANT ALL ON public.boatshow_leads TO service_role;
