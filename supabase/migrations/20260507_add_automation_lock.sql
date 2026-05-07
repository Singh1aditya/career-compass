-- Phase 5+ — human-takeover lock for sequence_recipients.
-- Once a reply is detected (or the user manually pauses), automation_active=false
-- and process-pending-sends will skip the recipient.
ALTER TABLE public.sequence_recipients
  ADD COLUMN IF NOT EXISTS automation_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- Add signature support to profiles (used by template variable {{my_signature}})
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature TEXT;

NOTIFY pgrst, 'reload schema';
