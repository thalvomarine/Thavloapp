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
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marine_zones;
