-- ====================================================================
-- Run this AFTER pulling the latest code (P1.4 + P1.6 schema additions).
-- Idempotent: safe to re-run.
-- ====================================================================

-- P1.4 — human takeover lock on sequence recipients
ALTER TABLE public.sequence_recipients
  ADD COLUMN IF NOT EXISTS automation_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- P1.5 — signature for template rendering
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature TEXT;

-- P1.6 — observability log table for edge functions
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  function_name TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON public.automation_logs (created_at DESC);
ALTER TABLE public.automation_logs DISABLE ROW LEVEL SECURITY;

-- Settings table for personal app (signature, send-window, etc.)
-- Use a single-row pattern keyed by user_id.
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
  display_name TEXT,
  signature TEXT,
  daily_email_cap INTEGER NOT NULL DEFAULT 50,
  per_tick_email_cap INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;

-- Seed default row
INSERT INTO public.user_settings (user_id, display_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Adi')
ON CONFLICT (user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
