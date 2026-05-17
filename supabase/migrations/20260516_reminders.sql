-- Phase 7: Smart Reminders

-- Extend user_settings with reminder preferences
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS digest_enabled     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_hour        SMALLINT NOT NULL DEFAULT 8
    CHECK (digest_hour BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS auto_followups_enabled BOOLEAN NOT NULL DEFAULT true;

-- Idempotency log for daily digest
CREATE TABLE IF NOT EXISTS digest_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary    JSONB,
  UNIQUE (user_id, (sent_at::date))
);

-- Track source of follow-ups (manual vs auto-generated)
ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
