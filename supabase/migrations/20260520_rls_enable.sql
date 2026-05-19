-- =====================================================================
-- Enable Row Level Security and install per-user policies on every
-- user-owned table. Drops the legacy zero-UUID DEFAULT so future
-- INSERTs must supply a real user id.
--
-- Run AFTER 20260519_auth_data_migration.sql. Idempotent — re-running
-- is safe; existing policies are dropped before recreation.
-- =====================================================================

BEGIN;

-- Helper: install a "user owns row via user_id" policy on a table.
-- Drops any existing policy with the same name first so this is rerunnable.
DO $$
DECLARE
  t TEXT;
  user_tables TEXT[] := ARRAY[
    'contacts',
    'companies',
    'applications',
    'interactions',
    'notes',
    'tags',
    'follow_ups',
    'sequences',
    'sequence_recipients',
    'oauth_tokens',
    'user_settings',
    'processed_emails',
    'attachments',
    'events',
    'ai_runs',
    'digest_log'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'owner_select_'||t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'owner_modify_'||t, t);
      EXECUTE format($f$
        CREATE POLICY %I ON public.%I FOR SELECT
        USING (user_id = auth.uid())
      $f$, 'owner_select_'||t, t);
      EXECUTE format($f$
        CREATE POLICY %I ON public.%I FOR ALL
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
      $f$, 'owner_modify_'||t, t);
      -- Drop the legacy default so accidental inserts without user_id fail
      -- loudly instead of silently writing to the zero UUID.
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP DEFAULT', t);
    END IF;
  END LOOP;
END $$;

-- contact_tags is a join table without its own user_id; it inherits
-- ownership through contacts. RLS scoped via the contact row.
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_contact_tags ON public.contact_tags;
CREATE POLICY owner_contact_tags ON public.contact_tags
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id AND c.user_id = auth.uid()
  ));

-- sequence_steps belongs to a sequence; ownership flows through.
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_sequence_steps ON public.sequence_steps;
CREATE POLICY owner_sequence_steps ON public.sequence_steps
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_steps.sequence_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_steps.sequence_id AND s.user_id = auth.uid()
  ));

-- sequence_sends flows through sequence_recipients -> sequences.
ALTER TABLE public.sequence_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_sequence_sends ON public.sequence_sends;
CREATE POLICY owner_sequence_sends ON public.sequence_sends
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sequence_recipients r
    JOIN public.sequences s ON s.id = r.sequence_id
    WHERE r.id = sequence_sends.recipient_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequence_recipients r
    JOIN public.sequences s ON s.id = r.sequence_id
    WHERE r.id = sequence_sends.recipient_id AND s.user_id = auth.uid()
  ));

-- application_status_history rows flow through applications.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='application_status_history') THEN
    EXECUTE 'ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS owner_app_status_history ON public.application_status_history';
    EXECUTE $f$
      CREATE POLICY owner_app_status_history ON public.application_status_history
        FOR ALL
        USING (EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id = application_status_history.application_id AND a.user_id = auth.uid()
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id = application_status_history.application_id AND a.user_id = auth.uid()
        ))
    $f$;
  END IF;
END $$;

-- Logs/diagnostics tables are admin-only; service role bypasses RLS so
-- edge functions can still write. Block public read.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_logs') THEN
    EXECUTE 'ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
