-- ============================================================
-- HARDENING.sql — closes the Critical / High findings from
-- the SystemBreaker QA pass on 2026-05-07.
-- Paste into Supabase SQL editor and Run. Idempotent.
--
-- Each block is paired with the finding it addresses and a
-- comment showing the exact attack vector that exposed it.
-- ============================================================

-- ----- CRITICAL #1 ---------------------------------------------------------
-- Finding: 100 dup recipients for the same (sequence_id, contact_id) all
-- inserted; cron would email the same person 100 times.
-- Vector: bulk insert of 100 identical sequence_recipients rows.
ALTER TABLE public.sequence_recipients
  DROP CONSTRAINT IF EXISTS sequence_recipients_unique_pair;
ALTER TABLE public.sequence_recipients
  ADD CONSTRAINT sequence_recipients_unique_pair UNIQUE (sequence_id, contact_id);

-- ----- HIGH #1 -------------------------------------------------------------
-- Finding: state='PWNED' accepted on sequence_recipients (silent skip in cron)
ALTER TABLE public.sequence_recipients
  DROP CONSTRAINT IF EXISTS sequence_recipients_state_check;
ALTER TABLE public.sequence_recipients
  ADD CONSTRAINT sequence_recipients_state_check
  CHECK (state IN ('waiting', 'initial_sent', 'followup_1', 'followup_2', 'followup_3', 'replied', 'bounced', 'closed'));

-- ----- HIGH #2 -------------------------------------------------------------
-- Finding: status='OWNED_BY_ATTACKER' / status='🤡' accepted on applications;
-- Kanban silently hides any unknown status (data appears lost).
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('wishlist', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn'));

-- ----- HIGH #3 -------------------------------------------------------------
-- Finding: contacts.contact_type accepted any string; UI groups under "Other".
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_contact_type_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IN ('recruiter', 'founder', 'referral', 'colleague', 'other'));

-- Same for contact status (active/archived only).
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_status_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_status_check
  CHECK (status IN ('active', 'archived'));

-- ----- HIGH #4 -------------------------------------------------------------
-- Finding: delay_days=-100 accepted; would schedule emails in the past.
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_delay_nonneg;
ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_delay_nonneg CHECK (delay_days >= 0 AND delay_days <= 365);

-- step_type whitelist
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_type_check;
ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_type_check
  CHECK (step_type IN ('initial', 'followup_1', 'followup_2', 'followup_3'));

-- step_number bounds
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_number_bounds;
ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_number_bounds CHECK (step_number BETWEEN 1 AND 4);

-- Unique step_number per sequence (no two "step 1" rows)
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_seq_step_unique;
ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_seq_step_unique UNIQUE (sequence_id, step_number);

-- ----- HIGH #5 -------------------------------------------------------------
-- Finding: 1.1MB name string accepted on contacts (DoS / abuse).
-- Cap reasonable lengths.
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_name_len_check,
  DROP CONSTRAINT IF EXISTS contacts_email_len_check,
  DROP CONSTRAINT IF EXISTS contacts_notes_len_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_name_len_check  CHECK (char_length(name)  BETWEEN 1   AND 200),
  ADD CONSTRAINT contacts_email_len_check CHECK (email IS NULL OR char_length(email) <= 320),
  ADD CONSTRAINT contacts_notes_len_check CHECK (notes IS NULL OR char_length(notes) <= 10000);

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_role_len_check,
  DROP CONSTRAINT IF EXISTS applications_notes_len_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_role_len_check  CHECK (char_length(role_title) BETWEEN 1 AND 200),
  ADD CONSTRAINT applications_notes_len_check CHECK (notes IS NULL OR char_length(notes) <= 10000);

ALTER TABLE public.sequences
  DROP CONSTRAINT IF EXISTS sequences_name_len_check,
  DROP CONSTRAINT IF EXISTS sequences_status_check;
ALTER TABLE public.sequences
  ADD CONSTRAINT sequences_name_len_check CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  ADD CONSTRAINT sequences_status_check   CHECK (status IN ('draft', 'active', 'paused', 'completed'));

ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_body_len_check,
  DROP CONSTRAINT IF EXISTS sequence_steps_subject_len_check;
ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_body_len_check CHECK (char_length(template_body)  BETWEEN 1 AND 50000),
  ADD CONSTRAINT sequence_steps_subject_len_check CHECK (template_subject IS NULL OR char_length(template_subject) <= 998);

-- ----- MEDIUM #1 -----------------------------------------------------------
-- Finding: tags table allowed 20 duplicate names due to no UNIQUE.
ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_user_name_unique;
ALTER TABLE public.tags
  ADD CONSTRAINT tags_user_name_unique UNIQUE (user_id, name);

-- ----- MEDIUM #2 -----------------------------------------------------------
-- Finding: follow_ups accepted year 1900 and 9999.
-- Bound to a sane range (today - 5y .. today + 5y) so UI grouping logic
-- doesn't choke on epoch corner cases.
-- Using a deferred check via trigger because CHECK can't reference now().
CREATE OR REPLACE FUNCTION public.follow_up_due_date_sane()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.due_date < CURRENT_DATE - INTERVAL '5 years'
     OR NEW.due_date > CURRENT_DATE + INTERVAL '5 years' THEN
    RAISE EXCEPTION 'follow_up due_date % is out of plausible range', NEW.due_date;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS follow_up_due_date_sane_trg ON public.follow_ups;
CREATE TRIGGER follow_up_due_date_sane_trg
  BEFORE INSERT OR UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.follow_up_due_date_sane();

-- ----- MEDIUM #3 -----------------------------------------------------------
-- Finding: replied/locked recipients can be reverted to active state via the
-- same anon key. Add a row-level guard: once automation_active=false with
-- lock_reason='reply_detected', that flip must go through a special path.
-- (Soft guard via trigger; app code can still set automation_active=true with
-- lock_reason=NULL after manual reset, but accidental reverts are caught.)
CREATE OR REPLACE FUNCTION public.guard_replied_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'replied'
     AND OLD.automation_active = false
     AND OLD.lock_reason = 'reply_detected'
     AND NEW.state <> 'replied'
     AND NEW.lock_reason IS DISTINCT FROM 'manual_reset' THEN
    RAISE EXCEPTION 'Recipient % is locked after reply detection. To re-engage, set lock_reason=''manual_reset'' explicitly.', OLD.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_replied_lock_trg ON public.sequence_recipients;
CREATE TRIGGER guard_replied_lock_trg
  BEFORE UPDATE ON public.sequence_recipients
  FOR EACH ROW EXECUTE FUNCTION public.guard_replied_lock();

NOTIFY pgrst, 'reload schema';
