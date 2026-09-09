ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS location_captured_at timestamptz;