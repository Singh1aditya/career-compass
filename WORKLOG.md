# Personal CRM — Work Log

Running history of work sessions. Newest entries at the top.

---

## 2026-05-12 — Gmail auth fixes + project cleanup + worklog skill

**Removed** stale one-off files: `breaker.mjs`, `breaker2.mjs`, `route-tests.mjs`, `test_results_audit.md`, `BUILD_SUMMARY.md`, `NEXT_STEPS.md`, `PHASE_2_IMPLEMENTATION.md`.

**Created** this `WORKLOG.md` and a `.claude/commands/log.md` slash command (`/log`) that appends a session summary here automatically.

**Gmail auth fixed** (4 bugs):

- `gmail-exchange-code` edge function: fetches Gmail address via userinfo API, persists tokens server-side using service role key (tokens no longer travel through browser), takes `redirect_uri` from the request so it's byte-for-byte identical to what Google expects.
- `callback.tsx`: removed client-side DB write entirely (edge function owns it now), passes `redirect_uri` in request body, surfaces real error messages, shows connected email in success toast.
- `SettingsPage.tsx`: switched to `maybeSingle()` (avoids PGRST116 error on empty token table), removed unused `Badge`/`XCircle` imports, fixed stale GMAIL_SETUP.md reference in error toast.

**Status**: Gmail connect flow is seamless. Edge functions must be deployed for the full flow to work (`supabase functions deploy gmail-exchange-code`).

---

## 2026-05-07 — Phase 5 + DB hardening + security audit

Refactored routes to directory layout (`/contacts/$contactId`, `/applications/$applicationId`, `/companies/$companyId`). Added mobile nav (`MobileNav.tsx`). Started outreach wizard (`StartOutreachWizard.tsx`). Applied DB hardening constraints (`supabase/HARDENING.sql`). Ran security audit (39 attack vectors, 8 critical) — all critical issues addressed via SQL constraints.

---

## 2026-05-06 — Phases 1–4 complete

- **Phase 1**: Contacts, Applications, Companies CRUD + detail pages, interactions, tags, notes, follow-ups.
- **Phase 2**: Outreach sequences — create/edit/delete, multi-step email templates with variables, recipient enrollment, state machine (`waiting → initial_sent → followup_N → replied/closed`).
- **Phase 3**: Gmail OAuth 2.0 integration — token storage/refresh, email send via Gmail API, reply detection, auto-interaction creation on reply.
- **Phase 4**: CSV import — drag-drop upload, auto-column detection, mapping UI, deduplication by email, validation, preview, batch import.

**Edge functions**: `send-email-via-gmail`, `gmail-exchange-code`, `monitor-gmail-replies`, `process-pending-sends`, `scan-job-emails`, `send-sequence-email`.

**Stack**: React + TypeScript + TanStack Router + Supabase + Gmail API. No auth (single-user, fixed UUID).
