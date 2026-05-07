-- =====================================================================
-- Cron schedule for sequence automation.
--
-- Run AFTER:
--   1) RUN_AFTER_PHASE5_IMPL.sql has been applied
--   2) Edge functions deployed (`supabase functions deploy …`)
--   3) Replace <ANON_KEY> below with the project's anon key from Settings > API.
--
-- Idempotent: re-run safely (cron.unschedule is no-op if absent).
-- =====================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any existing schedules with the same name so this script is idempotent
DO $$
DECLARE
  jobid bigint;
BEGIN
  FOR jobid IN
    SELECT j.jobid FROM cron.job j WHERE j.jobname IN
      ('crm-process-sends', 'crm-monitor-replies', 'crm-scan-job-emails')
  LOOP
    PERFORM cron.unschedule(jobid);
  END LOOP;
END $$;

-- 1) Send pending sequence emails every 15 minutes
SELECT cron.schedule(
  'crm-process-sends',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://cpbntgdqtvqrensrqjmy.supabase.co/functions/v1/process-pending-sends',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

-- 2) Detect replies every 15 minutes (offset by 5 to avoid simultaneous load)
SELECT cron.schedule(
  'crm-monitor-replies',
  '5,20,35,50 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://cpbntgdqtvqrensrqjmy.supabase.co/functions/v1/monitor-gmail-replies',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

-- 3) Scan inbox for application confirmation/rejection emails hourly
SELECT cron.schedule(
  'crm-scan-job-emails',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://cpbntgdqtvqrensrqjmy.supabase.co/functions/v1/scan-job-emails',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

-- Verify what's scheduled
-- SELECT jobid, jobname, schedule, active FROM cron.job;
