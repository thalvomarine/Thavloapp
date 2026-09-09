CREATE TABLE public.marine_zones (
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

CREATE POLICY "marine_zones: public read active" ON public.marine_zones
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "marine_zones: admins read all" ON public.marine_zones
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "marine_zones: admins insert" ON public.marine_zones
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "marine_zones: admins update" ON public.marine_zones
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "marine_zones: admins delete" ON public.marine_zones
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_marine_zones_updated
  BEFORE UPDATE ON public.marine_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.community_reports (
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

CREATE POLICY "community_reports: public read approved" ON public.community_reports
  FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "community_reports: read own" ON public.community_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "community_reports: admins read all" ON public.community_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "community_reports: insert own pending" ON public.community_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'pending_approval');
CREATE POLICY "community_reports: admins update" ON public.community_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
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