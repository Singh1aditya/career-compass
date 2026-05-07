-- Track Gmail messages already scanned by scan-job-emails edge function.
-- Prevents re-processing the same email and gives us an audit trail of
-- which application was created/updated from which email.
CREATE TABLE IF NOT EXISTS processed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('confirmation', 'rejection', 'unknown')),
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  action_taken TEXT NOT NULL CHECK (action_taken IN ('created', 'updated', 'noop', 'skipped')),
  detected_company TEXT,
  detected_role TEXT,
  email_subject TEXT,
  email_from TEXT,
  email_date TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_emails_user ON processed_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_message ON processed_emails(gmail_message_id);

ALTER TABLE processed_emails DISABLE ROW LEVEL SECURITY;
