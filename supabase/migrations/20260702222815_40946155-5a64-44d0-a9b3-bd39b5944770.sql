-- M7 Event Architecture v1 — platform_events table.
CREATE TABLE public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  subject_type text NOT NULL,
  subject_id uuid,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_events_created_at_idx ON public.platform_events (created_at DESC);
CREATE INDEX platform_events_actor_idx ON public.platform_events (actor_id);
CREATE INDEX platform_events_subject_idx ON public.platform_events (subject_type, subject_id);
CREATE INDEX platform_events_type_idx ON public.platform_events (event_type);

GRANT SELECT, INSERT ON public.platform_events TO authenticated;
GRANT ALL ON public.platform_events TO service_role;

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all events.
CREATE POLICY "Admins can read all events"
  ON public.platform_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read events they authored.
CREATE POLICY "Users can read their own events"
  ON public.platform_events FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

-- Authenticated users may insert safe client events, but ONLY as themselves.
-- TODO(M7): move privileged event writing to server functions / DB triggers
-- so trust/audit events cannot be forged. Client inserts should be limited
-- to non-privileged UI telemetry (viewed, opened) once server writers exist.
CREATE POLICY "Users can insert events as themselves"
  ON public.platform_events FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);
