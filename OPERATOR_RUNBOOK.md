# Operator Runbook — Production Setup

This is the exact sequence to follow once after `git pull`-ing the auth-migration
changes (commits that landed Workstreams A and B per `~/.claude/plans/prepare-the-project-to-staged-pie.md`).
Everything below is **manual, one-time, operator-only** work — none of it can be
done from inside the codebase.

Local dev only: no Cloudflare or Vercel deploy needed.

---

## 0. Prerequisites

- Supabase project linked locally (`supabase link --project-ref <ref>`).
- Supabase CLI installed: `brew install supabase/tap/supabase`.
- `.env.local` already contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  and `VITE_GOOGLE_CLIENT_ID`.
- Google Cloud OAuth Client created with redirect URI
  `http://localhost:8080/auth/gmail/callback` and the scopes
  `gmail.send`, `gmail.readonly`, `calendar.events`, `userinfo.email`.

---

## 1. Set edge function secrets (C1)

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID="$(grep VITE_GOOGLE_CLIENT_ID .env.local | cut -d= -f2)" \
  GOOGLE_CLIENT_SECRET="<from Google Cloud Console>" \
  ANTHROPIC_API_KEY="<from console.anthropic.com>" \
  FRONTEND_URL="http://localhost:8080"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

Optional client-side error reporting: add `VITE_SENTRY_DSN=...` to `.env.local`.

---

## 2. Create the `crm-files` storage bucket (C2)

In **Supabase Dashboard → Storage → New bucket**:

- Name: `crm-files`
- **Private** (no public access)

Then run this SQL once to give signed-URL access via the attachments table:

```sql
-- The app uses signed URLs (60-minute TTL) so it doesn't need a SELECT
-- policy on storage.objects. INSERT/DELETE go through the edge function.
CREATE POLICY "user_owns_attachment_objects"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'crm-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'crm-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 3. Apply migrations (C3)

```bash
supabase db push
```

This applies everything in `supabase/migrations/` in order, including the new
`20260519_auth_data_migration.sql` and `20260520_rls_enable.sql`.

> The two new migrations are gated — they look for the legacy zero-UUID rows and
> the data-migration SQL needs you to set the `:real_id` psql variable. If you
> haven't signed up yet, **defer them** by temporarily renaming them:
>
> ```bash
> cd supabase/migrations
> for f in 20260519_*.sql 20260520_*.sql; do mv "$f" "$f.deferred"; done
> supabase db push
> for f in *.sql.deferred; do mv "$f" "${f%.deferred}"; done
> ```

---

## 4. Deploy edge functions (C4)

```bash
for fn in ai-assist generate-auto-followups gmail-exchange-code monitor-gmail-replies \
          process-pending-sends quick-capture scan-job-emails send-daily-digest \
          send-email-via-gmail sync-gcal-event; do
  supabase functions deploy "$fn"
done
```

The two stub functions (`send-sequence-email`, `gmail-poll-replies`) were removed
in Workstream A.

---

## 5. Sign up — get a real `auth.users.id` (B-bridge step)

```bash
npm run dev
```

Visit `http://localhost:8080/dashboard`. The route guard sends you to the
`AuthForm`. Sign up with your email (or "Continue with Google").

Copy your new id:

```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
```

---

## 6. Run the auth data migration (B3)

In **Supabase Dashboard → SQL Editor**, paste the body of
`supabase/migrations/20260519_auth_data_migration.sql` but replace **every**
occurrence of `:real_id` and `:'real_id'` with your real UUID from step 5.

The script wraps everything in `BEGIN; ... COMMIT;` and ends with a sanity
SELECT that should report `0` for every table.

---

## 7. Enable RLS (B4)

In SQL Editor, run `supabase/migrations/20260520_rls_enable.sql` verbatim.
Verify policies are in place:

```sql
SELECT schemaname, tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename;
```

You should see `owner_select_*` and `owner_modify_*` policies on every
user-owned table plus the per-relation policies on `contact_tags`,
`sequence_steps`, `sequence_sends`, `application_status_history`.

---

## 8. Schedule crons (C5)

Edit `supabase/CRON_SETUP.sql` and replace **every** `<ANON_KEY>` placeholder
with the project anon key from **Settings → API**. Append the two missing
entries the audit found:

```sql
SELECT cron.schedule('crm-daily-digest', '0 8 * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-daily-digest',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb);
$$);

SELECT cron.schedule('crm-auto-followups', '15 8 * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/generate-auto-followups',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb);
$$);
```

Run the entire `CRON_SETUP.sql` in SQL Editor. Verify:

```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
```

You should see five active jobs:
`crm-process-sends`, `crm-monitor-replies`, `crm-scan-job-emails`,
`crm-daily-digest`, `crm-auto-followups`.

---

## 9. Regenerate Supabase types (C6, optional but recommended)

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
npm run build   # confirms nothing broke
```

This kills the hand-maintained type drift, which lets us remove most of the
`(supabase as any)` casts in `src/lib/insights.ts` and `src/lib/storage.ts`.

---

## 10. End-to-end smoke

1. `npm run dev` → `http://localhost:8080`.
2. Log in as the user from step 5.
3. **Connect Gmail** in Settings → OAuth flow completes; verify in SQL:
   `SELECT user_id, provider, email FROM oauth_tokens;` — should be your id.
4. Add a contact, an application, create an outreach sequence with one recipient.
5. From `/health`, click **Run all checks** — every function should respond.
6. Invoke `process-pending-sends` manually — verify a real email lands in the
   recipient's inbox and `sequence_sends` has a real `gmail_message_id`.
7. Reply to that email; wait ≤15 min for `monitor-gmail-replies`; verify the
   recipient transitions to `state='replied'` and an `interactions` row exists.
8. Upload a 1 MB PDF on a contact's Files tab; sign out, sign back in, verify
   the file still downloads via signed URL.
9. Open `/quick-add`, paste a real job posting, verify an `applications` +
   `companies` row created (needs `ANTHROPIC_API_KEY`).
10. Try `select * from contacts` from an anon-key session — should return zero
    rows (RLS is doing its job).

If step 6, 7, or 10 fails, the auth migration is incomplete — start at SQL
`SELECT user_id, count(*) FROM contacts GROUP BY 1;` and trace ownership.

---

## Reference — what changed in this push

- **Code bugs fixed**: three edge functions had `import` statements inside
  function bodies (Deno wouldn't load them):
  `send-email-via-gmail`, `process-pending-sends`, `monitor-gmail-replies`.
- **Stubs removed**: `send-sequence-email`, `gmail-poll-replies`.
- **Auth wired**: `useAuth` now reads real Supabase sessions; the
  `_authenticated` route renders `AuthForm` until a user signs in.
- **All ~50 `DEFAULT_USER_ID` references in src/ replaced** with `user.id`
  from `useAuth()`.
- **Edge functions migrated**: user-invoked endpoints read user id from the
  caller's JWT (`gmail-exchange-code`, `ai-assist`, `quick-capture`,
  `sync-gcal-event`, `send-email-via-gmail`). Cron-invoked endpoints
  (`process-pending-sends`, `monitor-gmail-replies`, `scan-job-emails`,
  `send-daily-digest`, `generate-auto-followups`) loop over
  `listGmailUsers()` — single-user today, multi-user-ready.
- **Two new migrations**: `20260519_auth_data_migration.sql` and
  `20260520_rls_enable.sql`.
- **Lovable auth wrapper removed**: `@lovable.dev/cloud-auth-js` dependency
  and `src/integrations/lovable/` deleted; Google OAuth now goes through
  Supabase directly.
