-- Track application status transitions for time-in-stage analytics
CREATE TABLE IF NOT EXISTS application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ash_application_id ON application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_ash_changed_at ON application_status_history(changed_at);

-- Trigger: auto-record status changes
CREATE OR REPLACE FUNCTION record_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO application_status_history(application_id, from_status, to_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_application_status_change ON applications;
CREATE TRIGGER trg_application_status_change
  AFTER UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION record_application_status_change();

-- Backfill: one entry per existing application from created_at to current status
INSERT INTO application_status_history(application_id, from_status, to_status, changed_at)
SELECT id, NULL, status, created_at FROM applications
ON CONFLICT DO NOTHING;
