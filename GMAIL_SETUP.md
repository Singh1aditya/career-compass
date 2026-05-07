# Gmail Integration Setup Guide

## Overview

This guide walks you through connecting Gmail to Career CRM to automatically send and monitor emails from outreach sequences.

**What you'll be able to do:**
- ✅ Send personalized emails from sequences to contacts
- ✅ Monitor replies and auto-detect responses
- ✅ Create interaction records when replies arrive
- ✅ Mark sequences as "replied" when contacts respond

---

## Step 1: Get Google OAuth Credentials

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click project dropdown → "New Project"
3. Name it "Career CRM"
4. Click "Create"

### 1.2 Enable Required APIs

1. Search for "Gmail API" in the search bar
2. Click "Gmail API" → "Enable"
3. Search for "Google+ API"
4. Click "Google+ API" → "Enable"

### 1.3 Create OAuth 2.0 Credentials

1. Go to "Credentials" in left sidebar
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen first:
   - User Type: "External"
   - Fill in app name "Career CRM"
   - Add your email as test user
4. For "OAuth client ID", select "Web application"
5. Add Authorized redirect URIs:
   - **Development**: `http://localhost:8080/auth/gmail/callback`
   - **Production**: `https://yourdomain.com/auth/gmail/callback`
6. Click "Create"
7. Copy the **Client ID** and **Client Secret** (you'll need these)

---

## Step 2: Set Environment Variables

The frontend (Vite) needs the **client ID prefixed with `VITE_`** so it's inlined into the bundle. The Supabase edge functions need the client secret as a server-side secret.

### 2a. Frontend — `.env.local`

```env
# Existing — already set
VITE_SUPABASE_URL=https://cpbntgdqtvqrensrqjmy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Add this — value comes from Step 1.3
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

After editing `.env.local`, **restart `npm run dev`** — Vite only re-reads env on startup.

### 2b. Edge functions — Supabase secrets (server-side only, never frontend)

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com \
  GOOGLE_CLIENT_SECRET=GOCSPX-... \
  FRONTEND_URL=http://localhost:8080
```

**For production**, update `FRONTEND_URL` and add your prod redirect URI to the Google OAuth client.

---

## Step 3: Deploy Edge Functions

If using Supabase CLI locally:

```bash
# First time: link your project
supabase link --project-ref xmkbvmyemtnfgoxtgzug

# Deploy functions
supabase functions deploy send-email-via-gmail
supabase functions deploy gmail-exchange-code
supabase functions deploy monitor-gmail-replies
```

If not using Supabase CLI, manually deploy via [Supabase Dashboard](https://app.supabase.com):

1. Go to your project → "Functions"
2. Click "Create a new function"
3. Create three functions:
   - `send-email-via-gmail`
   - `gmail-exchange-code`
   - `monitor-gmail-replies`
4. Copy the code from the corresponding files in `supabase/functions/`

---

## Step 4: Connect Gmail in the App

1. Start dev server: `npm run dev`
2. Navigate to `/settings`
3. Click "Connect Gmail"
4. Authorize the app to:
   - Send emails on your behalf
   - Read your Gmail
5. You'll be redirected back to Settings with confirmation

**Your tokens are now stored securely in the database.**

---

## Step 5: Test Sending an Email

1. Create a sequence with an email step:
   ```
   Subject: Hi {{first_name}}, interested in {{role}} at {{company}}?
   Body: Dear {{first_name}},
   
   I found your profile and think you'd be great for {{role}}.
   
   Would love to chat!
   ```

2. Add a recipient (a contact with a valid email)

3. Click "Send Now"

4. Check your Gmail inbox to verify the email was sent

---

## Step 6: Set Up Automatic Sending (Optional)

For production, set up scheduled sends via Supabase Cron:

### Option A: Via Supabase Dashboard

1. Go to your project → "Cron Jobs" (under Functions)
2. Create a new cron job:
   - Name: "Send Sequence Emails"
   - Function: `process-pending-sends`
   - Schedule: `0 9 * * *` (9am daily)
   - Timezone: Your timezone

3. Create another for reply monitoring:
   - Name: "Monitor Gmail Replies"
   - Function: `monitor-gmail-replies`
   - Schedule: `*/15 * * * *` (every 15 minutes)

### Option B: Via Supabase CLI

```bash
# Create cron.json in supabase/ directory
cat > supabase/cron.json << 'EOF'
[
  {
    "name": "send-sequence-emails",
    "function": "process-pending-sends",
    "cron": "0 9 * * *"
  },
  {
    "name": "monitor-replies",
    "function": "monitor-gmail-replies",
    "cron": "*/15 * * * *"
  }
]
EOF

# Deploy
supabase functions upsert-cron cron.json
```

---

## Step 7: Monitor Email Activity

**Check what's happening:**

1. **Sent emails**: Click sequence detail → "Recipients" tab
   - See each recipient's state (waiting, initial_sent, followup_1, replied, etc.)
   - See when next email will send

2. **Email log**: Click sequence detail → scroll down
   - See all sent emails with timestamps
   - See reply status

3. **Replies**: Go to Contacts
   - Click a contact → "Interactions" tab
   - See "Reply received" interaction when Gmail detects a response

---

## Troubleshooting

### "Gmail not connected" error when sending

**Check**:
1. Did you click "Connect Gmail" in Settings?
2. Are tokens stored? Check database:
   ```sql
   SELECT * FROM oauth_tokens 
   WHERE provider = 'gmail' AND user_id = '00000000-0000-0000-0000-000000000000';
   ```

### OAuth callback fails

**Check**:
1. Is the redirect URI in your Google OAuth app exactly: `http://localhost:8080/auth/gmail/callback`?
2. Are environment variables set correctly?
3. Check browser console for error messages

### Emails not sending from sequences

**Check**:
1. Is sequence status "active"?
2. Do recipients exist? Do they have "waiting" state?
3. Check current time >= recipient `next_send_at`
4. Check browser console for function errors
5. Check if Gmail tokens expired (need refresh)

### Replies not detected

**Check**:
1. Is `monitor-gmail-replies` function running?
2. Are emails sent with thread IDs? (should be stored in `sequence_sends.gmail_thread_id`)
3. Did the contact actually reply to the email thread?

---

## Security Notes

- **Tokens are encrypted** at rest in Supabase
- **Access tokens are short-lived** (1 hour) and auto-refresh
- **Refresh tokens never expire** but are stored securely
- **You can disconnect** at any time from Settings
- **Scopes are limited** to: `gmail.send` + `gmail.readonly` (no delete, no modify)

---

## Architecture

```
User clicks "Send Now"
    ↓
processPendingSends() in sequence-utils.ts
    ↓
Calls /functions/v1/send-email-via-gmail
    ↓
Function gets OAuth token from database
    ↓
Calls Gmail API to send email
    ↓
Logs email in sequence_sends table
    ↓
Updates recipient state

---

[Scheduled Every 15 min]
    ↓
monitor-gmail-replies() function
    ↓
Gets all sent emails with thread IDs
    ↓
Checks each thread for new messages
    ↓
If reply found: update state to "replied"
    ↓
Create interaction record
```

---

## Limits

- **Gmail API**: 500 emails/day (free tier)
- **Edge Functions**: 15-minute timeout
- **Token refresh**: Automatic when expired
- **Sequence sends**: No built-in rate limiting (add if needed)

---

## Next Steps

1. ✅ Connect Gmail
2. ✅ Create test sequence
3. ✅ Send test email
4. ✅ Verify reply detection works
5. → Set up cron jobs for automation
6. → Build Phase 4: CSV Import
7. → Build Phase 5: Analytics

---

## Support

If something doesn't work:

1. Check browser console (F12) for JavaScript errors
2. Check Supabase Edge Function logs
3. Verify database schema: `\d public.oauth_tokens`
4. Check Gmail API quota in Google Cloud Console
5. Try disconnecting and reconnecting Gmail

---

**Status**: Gmail integration ready! 🚀
