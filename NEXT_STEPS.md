# Hand-off — what you need to run manually

After this implementation pass, **all the code is in place** but a few things require Supabase Dashboard access or your CLI auth. Do these in order.

## 1. Apply the new schema (~30 sec)

Open https://supabase.com/dashboard/project/cpbntgdqtvqrensrqjmy/sql/new

Paste the contents of `supabase/RUN_AFTER_PHASE5_IMPL.sql` and click Run. This adds:

- `sequence_recipients.automation_active` + `lock_reason` (human-takeover lock)
- `profiles.signature`
- `automation_logs` table (observability)
- `user_settings` table (signature, caps)

## 2. Replace the service-role key in `.env.local` (~1 min, security-critical)

The frontend currently uses a `service_role` JWT, which is admin-level access if it ever leaves your laptop.

1. Go to https://supabase.com/dashboard/project/cpbntgdqtvqrensrqjmy/settings/api
2. Copy the **anon / public** key (JWT with `"role":"anon"` in the payload)
3. Edit `.env.local` and replace both `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` with that anon key
4. Click "Reset" on the **service_role** key to rotate it (since I had it in my logs)
5. Restart the dev server — `npm run dev`

Because RLS is off on every table, the anon key has full access for personal use; no security regression vs the current state.

## 3. Configure your signature (~1 min)

Open `localhost:8080/settings` → new "Profile & Sending Limits" card:

- Set **Display name** (replaces `{{my_name}}` in templates)
- Set **Email signature** (replaces `{{my_signature}}`)
- Optionally adjust per-tick / daily caps

## 4. Deploy the edge functions (~5 min, requires `supabase` CLI)

```bash
brew install supabase/tap/supabase   # if not installed
supabase login
supabase link --project-ref cpbntgdqtvqrensrqjmy
supabase secrets set GOOGLE_CLIENT_ID=<your-id> GOOGLE_CLIENT_SECRET=<your-secret> FRONTEND_URL=http://localhost:8080
supabase functions deploy send-email-via-gmail
supabase functions deploy gmail-exchange-code
supabase functions deploy monitor-gmail-replies
supabase functions deploy process-pending-sends
supabase functions deploy scan-job-emails
```

Quick sanity check:

```bash
curl -X POST https://cpbntgdqtvqrensrqjmy.supabase.co/functions/v1/scan-job-emails \
  -H "Authorization: Bearer <ANON_KEY>"
# Expect: {"success":false,"error":"Gmail not connected. Connect in Settings."}
```

## 5. Connect Gmail (~2 min)

`localhost:8080/settings` → "Connect Gmail" → OAuth flow.

> The redirect URI in your Google Cloud OAuth client must include `http://localhost:8080/auth/gmail/callback`.

## 6. Schedule the cron jobs (~2 min)

Open `supabase/CRON_SETUP.sql`. Search-and-replace `<ANON_KEY>` (3 occurrences) with the anon key from step 2. Paste into the SQL editor and Run.

```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
```

Should show 3 rows — `crm-process-sends`, `crm-monitor-replies`, `crm-scan-job-emails`.

## 7. End-to-end smoke test

1. Click any application card → detail page → **"Start Outreach Campaign"** → name it → save.
2. On the sequence detail page, **add 1+ steps** (initial + followups). Use template variables like `Hi {{first_name}}, …`.
3. Click **Add Recipients** — recipients are pre-filtered to contacts at the application's company; expand to "all" if needed.
4. Set the sequence status to **active** (toggle on the sequence detail page).
5. Within 15 minutes the cron tick fires, `process-pending-sends` runs, and emails go out.
6. Reply to the test email from another inbox.
7. Within 15 minutes, `monitor-gmail-replies` flips that recipient's `state` to `replied` and `automation_active` to `false`. An interaction row is created.

Watch progress in `localhost:8080/settings` (Email Auto-Ingest card) and `select * from automation_logs order by created_at desc limit 50` in the SQL editor.

## What was built in this pass

- **Detail pages**: `ContactDetailPage`, `ApplicationDetailPage`, `CompanyDetailPage` with tabs (Overview / Interactions / Notes / Follow-ups / Tags / linked Applications / Sequences).
- **Reusables**: `LogInteractionDialog`, `TagEditor`, `NotesList`, `FollowUpsList`, `UserSettingsPanel`.
- **Routes**: `/contacts/$contactId`, `/applications/$applicationId`, `/companies/$companyId`.
- **Sequence engine**:
  - "Start Outreach Campaign" button from the application
  - Smart recipient selection (filtered by application's company, grouped by contact_type, group select-all, toggle to "all companies")
  - Single `renderTemplate()` in `src/lib/templates.ts` + matching Deno copy in `process-pending-sends/index.ts` — no more 3-way drift
  - New variables: `{{first_name}}`, `{{full_name}}`, `{{company}}`, `{{role}}`, `{{contact_email}}`, `{{my_name}}`, `{{my_signature}}`
- **Reliability**:
  - `automation_active` + `lock_reason` on recipients — process-pending-sends respects it; monitor-gmail-replies sets it on reply
  - 1 retry + bounce detection on Gmail send failures
  - Per-tick send cap (configurable in Settings, default 10/tick)
  - Out-of-office reply detection (won't transition state on auto-replies)
  - `automation_logs` observability table — queryable with SQL
- **Schema additions**: `automation_logs`, `user_settings`, `processed_emails` (already there) plus new columns above.
- **Cron**: `supabase/CRON_SETUP.sql` schedules pg_cron jobs every 15 min for sends + replies, hourly for inbox scan.
- **Bug fixes**: pre-existing JSX parse errors in `SequenceDetailPage`/`TemplatePreview` (template-variable docs lines were broken). Stale `types.ts` replaced with permissive shim.

## Known follow-ups (not done in this pass)

- Bulk operations on Contacts/Applications (multi-select, archive, etc.)
- Standalone "Compose Email" route (one-off sends outside a sequence)
- Lift ⌘K listener up to AppSidebar so it works when sidebar is collapsed
- Optimistic UI rollback on Kanban drop
- Regenerate `src/integrations/supabase/types.ts` properly via CLI when you log in
- Empty-state illustrations on detail tabs
- 32/33 system tests pass; 1 brittle test ("all 7 kanban statuses present") drifts when you actually use the kanban — relax that assertion or re-seed before running.
