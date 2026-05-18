# Personal CRM — Development Plan

_Last updated: 2026-05-13_

A focused, opinionated roadmap for the next phases of this job-search CRM. Built from a survey of the current codebase, not from a wish list.

---

## 1. What the system is today

A single-user, browser-based job-search CRM built on **TanStack Start + Supabase + Gmail API**, with no real authentication (a hardcoded user UUID).

### Working surface area

- **Entities**: `contacts`, `companies`, `applications`, `interactions`, `notes`, `tags`, `follow_ups`
- **List + detail pages** for each, mobile nav, global search
- **Applications kanban** ([src/components/ApplicationsKanban.tsx](src/components/ApplicationsKanban.tsx))
- **Outreach sequences**: multi-step email campaigns, state machine, template variables, recipient enrollment, manual + cron-driven sending
- **Gmail integration**:
  - OAuth via [supabase/functions/gmail-exchange-code](supabase/functions/gmail-exchange-code/index.ts) (tokens stored server-side as of 2026-05-12)
  - Send via `send-email-via-gmail`
  - Reply detection via `monitor-gmail-replies` and `gmail-poll-replies`
  - Inbox scanning for confirmations + rejections via [scan-job-emails](supabase/functions/scan-job-emails/index.ts)
- **CSV import** with auto-mapping, dedup, validation ([src/components/pages/ImportPage.tsx](src/components/pages/ImportPage.tsx))
- **Dashboard** with counts, pipeline-by-status, action queue, recent activity ([src/components/pages/DashboardPage.tsx](src/components/pages/DashboardPage.tsx))
- **DB hardening** SQL applied; security audit done

### Tech baseline

- React 19, TanStack Router/Query, Tailwind v4, shadcn/Radix, lucide, papaparse, recharts (installed but mostly unused), date-fns, sonner, dnd-kit
- Supabase JS, edge functions in Deno, Vite + Cloudflare plugin
- No Supabase Auth — `DEFAULT_USER_ID = '00000000-...'` strewn across the code

---

## 2. Honest limitations

These are the gaps a real daily user would feel within a week of using the app.

### 2.1 Data & integrations

1. **No file storage.** `applications.resume_version` is a free-text label; resumes/cover letters/JD PDFs cannot be attached. No Supabase Storage bucket configured.
2. **No calendar.** Interviews have no scheduled time, no reminders, no Google Calendar mirror.
3. **No LinkedIn / enrichment path.** Contacts are typed in by hand or imported from CSV; no way to paste a LinkedIn URL and pull name/role/company.
4. **No data export.** Import exists, export does not. Locks the user in.
5. **Scan-job-emails is narrow.** Only confirmation + rejection regexes; misses interview invites, recruiter outreach, offers, scheduling links. Doesn't link emails to a specific application reliably.
6. **No threaded email view.** Replies create interactions but the user can't see the original thread inside the CRM.

### 2.2 Workflow holes

7. **No reminders/notifications anywhere.** `follow_ups` exist but nothing fires — no email, no browser push, no daily digest.
8. **No bulk operations.** Can't multi-select contacts to tag, archive, enroll in a sequence, or change status.
9. **No quick-capture.** No bookmarklet, no "paste a JD and create an application," no chrome extension.
10. **Sequences lack pause-per-recipient, A/B variants, and proper "stop on reply across any channel."**
11. **Follow-ups are not auto-generated** from state changes (e.g., interview scheduled → reminder 24h before; no reply after 7d → suggest follow-up).
12. **Kanban does not drive side effects** — moving a card to `rejected` doesn't close open follow-ups or stop sequences.

### 2.3 Insight & intelligence

13. **Dashboard is counts + lists.** No conversion funnel, no response-rate, no time-in-stage, no weekly trend (despite `recharts` already in `package.json`).
14. **No AI assistance.** No draft-with-AI for first emails or replies, no thread summarization, no auto-tagging, no JD-vs-resume gap analysis.
15. **No goal tracking** (applications/week, replies/week, interviews/month).

### 2.4 Platform

16. **No auth.** Single hardcoded UUID. Fine for personal use today, but blocks multi-device safety (anyone with the URL writes to the DB), backups, and ever sharing the tool.
17. **Edge function ops are manual.** Cron rows exist in `CRON_SETUP.sql` but deployment status is implicit; there's no in-app surface showing "last scan ran 4 min ago, ok / failed."
18. **No automated tests.** Zero `vitest`/`playwright`. Edge functions are deployed and prayed over.
19. **No error reporting.** No Sentry, no log surface.

---

## 3. What to build, why, and in what order

Two filters were applied: **(a)** must remove a friction the single user (you) actually feels weekly, and **(b)** must be buildable in this stack without a heroic migration. Phases are independently shippable.

### Priority legend

- **P0** — high leverage, low risk, ship next
- **P1** — high leverage, moderate effort
- **P2** — nice-to-have, ship if Phases 6–9 land cleanly

---

## Phase 6 — Insights Dashboard (P0)

**Why.** The data is already there; the user can't see trends. `recharts` is already installed. Highest ratio of value to LOC.

**Scope**

- Funnel chart: `wishlist → applied → screening → interviewing → offer` with drop-off counts
- Response-rate card: replied / sent across all sequences (last 30/90 days, toggle)
- Time-in-stage: median days between status transitions (requires `application_status_history` — see DB section)
- Weekly trend: applications submitted per week, interviews scheduled per week (last 12 weeks)
- "This week" tile: applications sent, replies received, interviews booked, follow-ups completed

**DB changes**

- New table `application_status_history (id, application_id, from_status, to_status, changed_at)` populated by a trigger on `applications` update
- Backfill once from `applications.created_at` + current status

**Files**

- New: [src/components/pages/InsightsPage.tsx](src/components/pages/InsightsPage.tsx), [src/routes/\_authenticated/insights.tsx](src/routes/_authenticated/insights.tsx)
- New: `src/lib/insights.ts` (pure aggregation, easy to unit-test)
- Migration: `supabase/migrations/20260514_application_status_history.sql`

**Acceptance**

- Funnel reflects 100% of `applications` rows
- Closing the browser and reopening preserves chosen time window (URL search param)
- All queries return in <300ms on 500 applications

**Estimate.** 1–2 evenings.

---

## Phase 7 — Smart Reminders + Auto Follow-ups (P0)

**Why.** Follow-ups are entered manually and nothing reminds you. This is the largest source of "I forgot to email them back" pain in any CRM.

**Scope**

1. **Daily digest email** at 8am local time (cron-driven edge function `send-daily-digest`):
   - Overdue follow-ups
   - Sequences with no activity in 7 days
   - Replies received yesterday
   - This-week stats vs. weekly goal
2. **Auto follow-up suggestions**:
   - When `applications.status` flips to `applied` and no interaction in 7 days → suggest a follow-up
   - When a sequence recipient hits `initial_sent` with no reply after the configured `delay_days`, auto-create a `follow_ups` row (instead of silently advancing)
3. **In-app toast on overdue follow-ups** at app load
4. **Browser push** (optional, via the Notifications API — no service worker needed for foreground)

**DB**

- New table `digest_log (id, sent_at, summary jsonb)` — for idempotency + UI history
- `follow_ups.source TEXT DEFAULT 'manual'` — distinguish auto-generated from user-entered

**Files**

- New: `supabase/functions/send-daily-digest/index.ts`
- New: `supabase/functions/generate-auto-followups/index.ts`
- Update: [src/components/pages/SettingsPage.tsx](src/components/pages/SettingsPage.tsx) — add "daily digest time" + "auto follow-ups on/off" toggles
- New: `src/components/DigestPreview.tsx` — preview the email template

**Acceptance**

- Calling `send-daily-digest` twice in one day is idempotent (writes once)
- Auto follow-ups for the same application/recipient are not duplicated
- Settings toggle disables auto-generation within one cron cycle

**Estimate.** 2 evenings.

---

## Phase 8 — File Attachments (P0)

**Why.** A job CRM that can't hold resume/cover/JD files is incomplete. Everything else is in place — we just need a bucket and an attachments table.

**Scope**

- Supabase Storage bucket `crm-files` (private, signed URLs)
- Drag-drop uploads on `ApplicationDetailPage`, `ContactDetailPage`, `CompanyDetailPage`
- File-type filter: pdf, doc/docx, txt, png/jpg (≤10MB)
- Resume version picker on application: pick from your library or upload new

**DB**

```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT, -- 'resume' | 'cover_letter' | 'jd' | 'other'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((application_id IS NOT NULL)::int + (contact_id IS NOT NULL)::int + (company_id IS NOT NULL)::int = 1)
);
```

**Files**

- New: `src/components/AttachmentsList.tsx` (reusable on all 3 detail pages)
- New: `src/lib/storage.ts` — upload, signed-URL fetch, delete

**Acceptance**

- Uploading a 5MB PDF persists across reload
- Deleting an application cascades and removes blob (use Storage's bucket-level cleanup or an edge function on delete)
- A user can mark one resume per application as the "submitted" one

**Estimate.** 1–2 evenings.

---

## Phase 9 — AI Copilot (P1)

**Why.** Email drafting is the single most repetitive task. Claude API can collapse 10 minutes of writing into 30 seconds of editing.

**Scope** (all server-side, via a new edge function `ai-assist`)

1. **Draft initial outreach email** — input: contact + application + tone; output: subject + body
2. **Draft reply** — input: thread, output: 2 reply options
3. **Summarize thread** — produces 1-line summary stored on the interaction
4. **JD vs. resume gap analysis** — paste a JD, get a bullet list of resume gaps (uses uploaded resume attachment from Phase 8)
5. **Auto-tag contact** — given email signature + role, suggest tags (`recruiter`, `hiring-manager`, `referral`, …)

**Model.** Default `claude-haiku-4-5` for speed; `claude-sonnet-4-6` for JD analysis. All calls cached with prompt caching to keep cost down (skill `claude-api` provides the pattern).

**DB**

- `ai_runs (id, kind, input_hash, output, tokens_in, tokens_out, cost_usd, created_at)` — for cost visibility
- API key stored in Supabase Vault, not in client env

**Files**

- New: `supabase/functions/ai-assist/index.ts`
- New: `src/components/AIComposeButton.tsx` — drop into reply box, into sequence step editor, into application page
- New: [src/components/pages/SettingsPage.tsx](src/components/pages/SettingsPage.tsx) section — show monthly AI usage + spend

**Acceptance**

- First draft generation <3s p50
- Same prompt within 5 min returns cached response (no second API charge)
- All output streams to the UI (no blank-screen wait)

**Estimate.** 2–3 evenings.

---

## Phase 10 — Calendar + Interview Scheduling (P1)

**Why.** Interviews are the most schedule-sensitive item in a job search and they're currently just a free-text date.

**Scope**

- New entity `events (id, application_id, contact_id, kind, scheduled_at, duration_min, location, meeting_url, notes)`
- Detail-page "Schedule interview" dialog → creates event + auto-creates a 24h-prior `follow_ups` row
- One-way Google Calendar sync: push events to a chosen calendar (uses existing Gmail OAuth scopes — request `calendar.events` on next OAuth)
- Calendar view (`/calendar`) — month grid using `react-day-picker` (already installed)

**Acceptance**

- Creating an event creates a corresponding Google Calendar entry within 5s
- Editing the event in-app updates the Calendar entry (not a duplicate)
- Cancelling deletes the Calendar entry

**Estimate.** 2–3 evenings.

---

## Phase 11 — Quick Capture (P1)

**Why.** The "I just saw a job posting" moment happens on the phone or in the browser, not in this app.

**Scope**

- **Bookmarklet** that captures `{ url, title, selection }` from any page and posts to a new edge function `quick-capture` which creates a `applications` row in `wishlist`
- **Paste-a-JD form** at `/quick-add` — pastes a job description, an AI parser extracts company, role, location, source, and creates application + company in one click
- **Email-to-app**: dedicated address `crm-in+<user>@…` — forward a JD email to it, it becomes an application. Implemented via inbound parse on Gmail (filter watches a label).

**Acceptance**

- Bookmarklet works on LinkedIn, Greenhouse, Lever, Ashby
- Paste-JD parses correctly on 4 of 5 sample postings without manual edits

**Estimate.** 2 evenings.

---

## Phase 12 — Bulk Operations + Saved Views (P2)

**Why.** Once you have 500+ contacts from CSV imports, single-row ops don't scale.

**Scope**

- Multi-select checkboxes on contacts/applications list
- Bulk actions: tag, untag, archive, change status, enroll in sequence, delete
- Saved views: persisted filters in `localStorage` first, `saved_views` table later

**Estimate.** 1 evening.

---

## Phase 13 — Auth + Multi-device safety (P2)

**Why.** Today, anyone who knows the URL can write to the database. This is fine alone but blocks ever opening the app on an unsecured network.

**Scope**

- Enable Supabase Auth (email magic link)
- Re-introduce RLS using a real `auth.uid()`
- One-time data migration: rewrite the hardcoded `00000000-…` UUID to the real user id
- Delete `DEFAULT_USER_ID` constants across the code (currently in [scan-job-emails/index.ts:19](supabase/functions/scan-job-emails/index.ts#L19), CSV import, and elsewhere)

**Risk.** Touches every table. Do this last; ship behind a feature branch with seed-data verification.

**Estimate.** 1–2 evenings, plus careful migration.

---

## Phase 14 — Reliability (P2, parallelizable)

**Why.** No tests + no error reporting = silent breakage.

**Scope**

- Add `vitest` + a handful of unit tests for `src/lib/*` (`sequence-utils`, `csv-utils`, `insights`)
- Add `@sentry/react` with a free tier for client errors
- Add a `/health` route that pings each edge function and shows green/red — surfaces stale crons
- Add a Storybook-free, simple Playwright smoke test for the four main pages

**Estimate.** 1 evening.

---

## 4. Cross-cutting cleanup (do alongside Phase 6)

Small, low-risk hygiene:

- Delete the dangling docs from `git status` (`BUILD_SUMMARY.md`, `NEXT_STEPS.md`, `PHASE_2_IMPLEMENTATION.md`, the old `applications.tsx` route shims) — confirm with `git log -p` first
- Centralise the `DEFAULT_USER_ID` constant in `src/lib/constants.ts` instead of redefining in every file (makes Phase 13 a one-line change)
- Move the inline `statusColors` map (duplicated across [DashboardPage.tsx](src/components/pages/DashboardPage.tsx), [ApplicationDetailPage.tsx](src/components/pages/ApplicationDetailPage.tsx), kanban, and others) into `src/lib/status.ts`
- Generate Supabase types: `supabase gen types typescript --linked > src/integrations/supabase/types.ts` — kills the hand-typed `interface Application { ... }` drift

---

## 5. Suggested order of execution

| Order | Phase                        | Effort   | User-felt impact           |
| ----- | ---------------------------- | -------- | -------------------------- |
| 1     | Cleanup (§4)                 | 0.5 day  | Dev velocity               |
| 2     | Phase 6 — Insights           | 1–2 days | High                       |
| 3     | Phase 8 — Files              | 1–2 days | High                       |
| 4     | Phase 7 — Reminders + digest | 2 days   | Very high                  |
| 5     | Phase 9 — AI Copilot         | 2–3 days | Very high                  |
| 6     | Phase 10 — Calendar          | 2–3 days | Medium-high                |
| 7     | Phase 11 — Quick capture     | 2 days   | Medium                     |
| 8     | Phase 14 — Reliability       | 1 day    | Internal                   |
| 9     | Phase 12 — Bulk ops          | 1 day    | Low until data grows       |
| 10    | Phase 13 — Auth              | 1–2 days | Low (safety, not features) |

Total: **~3 calendar weeks of evening work** to land everything through Phase 11.

---

## 6. Decisions still to make

These should be answered before starting Phase 7 or 9 — they affect architecture, not just code.

1. **AI model billing.** Personal Anthropic API key in Supabase Vault, or front the calls with a tiny rate-limited proxy on Cloudflare? Cost matters once Copilot is used daily.
2. **Digest delivery channel.** Email via Gmail API (you'll see your own digest in your inbox) or browser push only? Email is more reliable.
3. **Calendar scope vs. trust.** Adding the Google Calendar scope means re-doing OAuth consent. Worth doing once, properly, in Phase 10.
4. **Auth deferral.** Comfortable shipping Phases 6–12 without auth, then doing the auth migration in Phase 13? Or block now? Recommendation: defer — single-user with a non-guessable URL is acceptable risk for personal use.
