
CREATE OR REPLACE FUNCTION public.mask_job_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original text := COALESCE(NEW.text, '');
  masked_text text := original;
  blocked text[] := '{}';
  forbidden text[] := ARRAY[
    'iban','bank','banka','hesap','transfer','havale','eft',
    'cash','nakit','elden',
    'whatsapp','wp','telegram','signal',
    'phone number','telefon','telefonum','ara beni','call me',
    'instagram','dm me'
  ];
  w text;
BEGIN
  -- Forbidden keyword redaction (word-boundary, case-insensitive)
  FOREACH w IN ARRAY forbidden LOOP
    IF masked_text ~* ('\m' || regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M') THEN
      blocked := array_append(blocked, w);
      masked_text := regexp_replace(masked_text,
        '\m' || regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M',
        '█████', 'gi');
    END IF;
  END LOOP;

  -- TR mobile / generic phone
  IF masked_text ~* '(\+?90 ?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}' THEN
    blocked := array_append(blocked, 'phone');
    masked_text := regexp_replace(masked_text,
      '(\+?90 ?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}',
      '███-███-████', 'gi');
  END IF;
  IF masked_text ~ '(\+?\d[\s\-().]?){7,}' THEN
    blocked := array_append(blocked, 'phone');
    masked_text := regexp_replace(masked_text,
      '(\+?\d[\s\-().]?){7,}', '███-███-████', 'g');
  END IF;

  -- IBAN
  IF masked_text ~* '[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}' THEN
    blocked := array_append(blocked, 'IBAN');
    masked_text := regexp_replace(masked_text,
      '[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}', '██ IBAN BLOCKED ██', 'gi');
  END IF;

  -- Email
  IF masked_text ~* '[[:alnum:]._+-]+@[[:alnum:]-]+\.[[:alnum:].-]+' THEN
    blocked := array_append(blocked, 'email');
    masked_text := regexp_replace(masked_text,
      '[[:alnum:]._+-]+@[[:alnum:]-]+\.[[:alnum:].-]+', '███@███', 'gi');
  END IF;

  NEW.text := masked_text;
  NEW.blocked_terms := (
    SELECT COALESCE(array_agg(DISTINCT x), '{}')
    FROM unnest(blocked) AS x
  );
  NEW.masked := array_length(NEW.blocked_terms, 1) IS NOT NULL
                AND array_length(NEW.blocked_terms, 1) > 0;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mask_job_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_messages_mask_before_insert ON public.job_messages;
CREATE TRIGGER job_messages_mask_before_insert
BEFORE INSERT ON public.job_messages
FOR EACH ROW EXECUTE FUNCTION public.mask_job_message();
