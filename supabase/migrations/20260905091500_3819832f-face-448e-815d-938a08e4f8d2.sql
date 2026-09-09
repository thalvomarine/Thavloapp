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

CREATE POLICY "community_reports: authenticated insert pending" ON public.community_reports
  FOR INSERT TO authenticated
  WITH CHECK (status = 'pending_approval' AND (reporter_id = auth.uid() OR reporter_id IS NULL));

CREATE POLICY "community_reports: anon insert pending" ON public.community_reports
  FOR INSERT TO anon
  WITH CHECK (status = 'pending_approval' AND reporter_id IS NULL);
