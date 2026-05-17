-- Phase 10: Calendar + Interview Scheduling

CREATE TABLE IF NOT EXISTS events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL DEFAULT 'interview'
                   CHECK (kind IN ('interview','phone_screen','technical','offer_call','networking','other')),
  title          TEXT NOT NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  duration_min   INTEGER NOT NULL DEFAULT 60,
  location       TEXT,
  meeting_url    TEXT,
  notes          TEXT,
  gcal_event_id  TEXT,
  gcal_calendar_id TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_user_scheduled ON events(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_events_application ON events(application_id);
CREATE INDEX IF NOT EXISTS idx_events_contact ON events(contact_id);

-- Auto-create a follow_up 24h before the event
CREATE OR REPLACE FUNCTION create_event_reminder()
RETURNS TRIGGER AS $$
DECLARE
  reminder_date DATE;
BEGIN
  reminder_date := (NEW.scheduled_at - INTERVAL '1 day')::date;
  INSERT INTO follow_ups(user_id, application_id, contact_id, description, due_date, priority, status, source)
  VALUES (
    NEW.user_id,
    NEW.application_id,
    NEW.contact_id,
    'Prepare for: ' || NEW.title,
    reminder_date,
    'high',
    'pending',
    'auto'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_reminder ON events;
CREATE TRIGGER trg_event_reminder
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION create_event_reminder();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION touch_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION touch_events_updated_at();
