-- Storage bucket (run separately in Supabase dashboard if CLI isn't available)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('crm-files', 'crm-files', false)
-- ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES contacts(id)    ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id)   ON DELETE CASCADE,
  kind TEXT CHECK (kind IN ('resume','cover_letter','jd','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_parent CHECK (
    (application_id IS NOT NULL)::int +
    (contact_id IS NOT NULL)::int +
    (company_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_att_application ON attachments(application_id);
CREATE INDEX IF NOT EXISTS idx_att_contact ON attachments(contact_id);
CREATE INDEX IF NOT EXISTS idx_att_company ON attachments(company_id);
