-- =====================================================================
-- Auth data migration — rewrite all rows owned by the legacy zero UUID
-- to the operator's real Supabase Auth user id.
--
-- Run AFTER:
--   1) The operator has signed up via the new AuthForm (so a row exists
--      in auth.users for them).
--   2) BEFORE running 20260520_rls_enable.sql.
--
-- How to run:
--   Set the :real_id psql variable to the new auth.users.id, e.g.
--
--     psql ... -v real_id="'11111111-1111-1111-1111-111111111111'" \
--           -f 20260519_auth_data_migration.sql
--
--   Or in Supabase SQL editor, replace :real_id with a quoted UUID
--   literal before running.
-- =====================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Per-table sweep. Each table's user_id default was '0000…0000' so the
-- WHERE clause finds exactly the seed data we want to migrate.
UPDATE public.contacts            SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.companies           SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.applications        SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.interactions        SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.notes               SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.tags                SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.follow_ups          SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.sequences           SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.sequence_recipients SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.processed_emails    SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.oauth_tokens        SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.user_settings       SET user_id = :real_id WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Tables that may not exist on every project — guard each so a missing
-- table doesn't abort the whole migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attachments') THEN
    EXECUTE format('UPDATE public.attachments SET user_id = %L WHERE user_id = %L',
                   :'real_id', '00000000-0000-0000-0000-000000000000');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='events') THEN
    EXECUTE format('UPDATE public.events SET user_id = %L WHERE user_id = %L',
                   :'real_id', '00000000-0000-0000-0000-000000000000');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_runs') THEN
    EXECUTE format('UPDATE public.ai_runs SET user_id = %L WHERE user_id = %L',
                   :'real_id', '00000000-0000-0000-0000-000000000000');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='digest_log') THEN
    EXECUTE format('UPDATE public.digest_log SET user_id = %L WHERE user_id = %L',
                   :'real_id', '00000000-0000-0000-0000-000000000000');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='application_status_history') THEN
    -- application_status_history rows have no user_id directly; they
    -- inherit ownership from the parent application. Nothing to update.
    NULL;
  END IF;
END $$;

COMMIT;

-- Sanity check — should report zero rows still owned by the legacy id.
SELECT 'contacts'             AS table_name, count(*) AS legacy_rows FROM public.contacts            WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'companies',         count(*) FROM public.companies           WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'applications',      count(*) FROM public.applications        WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'interactions',      count(*) FROM public.interactions        WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'notes',             count(*) FROM public.notes               WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'tags',              count(*) FROM public.tags                WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'follow_ups',        count(*) FROM public.follow_ups          WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'sequences',         count(*) FROM public.sequences           WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'sequence_recipients', count(*) FROM public.sequence_recipients WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'oauth_tokens',      count(*) FROM public.oauth_tokens        WHERE user_id = '00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'user_settings',     count(*) FROM public.user_settings       WHERE user_id = '00000000-0000-0000-0000-000000000000';
