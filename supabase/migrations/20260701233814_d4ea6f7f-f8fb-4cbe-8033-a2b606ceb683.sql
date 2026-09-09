GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Temporary simulation profiles read access'
  ) THEN
    CREATE POLICY "Temporary simulation profiles read access"
    ON public.profiles
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Temporary simulation profiles create access'
  ) THEN
    CREATE POLICY "Temporary simulation profiles create access"
    ON public.profiles
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Temporary simulation profiles edit access'
  ) THEN
    CREATE POLICY "Temporary simulation profiles edit access"
    ON public.profiles
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Temporary simulation jobs read access'
  ) THEN
    CREATE POLICY "Temporary simulation jobs read access"
    ON public.jobs
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Temporary simulation jobs create access'
  ) THEN
    CREATE POLICY "Temporary simulation jobs create access"
    ON public.jobs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Temporary simulation jobs edit access'
  ) THEN
    CREATE POLICY "Temporary simulation jobs edit access"
    ON public.jobs
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;