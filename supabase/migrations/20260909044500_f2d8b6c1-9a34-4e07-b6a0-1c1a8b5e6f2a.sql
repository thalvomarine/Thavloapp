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
