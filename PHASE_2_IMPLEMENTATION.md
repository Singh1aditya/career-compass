# Phase 2: Outreach Sequences - Implementation Guide

## ✅ What's Been Built

### 1. **Recipient Management**
- **Component**: `AddRecipientsDialog.tsx`
- **Features**:
  - Search contacts by name/email
  - Batch select multiple contacts
  - Enroll in sequence with initial state
  - Automatically calculates first send time based on initial step delay

**Usage**: Click "Add Recipients" tab on sequence detail page

---

### 2. **Template Preview System**
- **Component**: `TemplatePreview.tsx`
- **Features**:
  - Preview emails with variable substitution
  - Select different contacts to see personalized output
  - Shows available variables: `{{first_name}}`, `{{company}}`, `{{role}}`, `{{my_name}}`
  - Live rendering as you type

**Usage**: Click "Preview" button when adding sequence steps

---

### 3. **Email Sending Logic**
- **File**: `src/lib/sequence-utils.ts`
- **Functions**:
  - `renderTemplate()` - Substitutes variables in subject/body
  - `processPendingSends()` - Processes all pending emails
  - `getSequenceStats()` - Returns stats (waiting, sent, replied, bounced, closed)

**Features**:
- Automatic state machine: `waiting` → `initial_sent` → `followup_1` → `followup_2` → `followup_3`
- Respects delays: waits N days between steps before sending
- Only sends to active sequences
- Skips bounced/replied contacts

**Usage**: Click "Send Now" button on sequence detail page

---

### 4. **Sequence Management UI**
- **Pages**:
  - `/sequences` - List all sequences with filters
  - `/sequences/:id` - Detail page with 2 tabs:
    - **Email Steps**: Add/edit/delete email templates
    - **Recipients**: View enrolled contacts and their states

**Features**:
- Draft/Active/Paused/Completed states
- Play/Pause buttons to toggle active state
- Delete sequences
- Add multiple email steps with delays

---

### 5. **Gmail OAuth Integration**
- **Components**: Updated `SettingsPage.tsx`
- **Route**: `/settings` with Gmail connection UI
- **Flow**:
  1. Click "Connect Gmail" button
  2. Redirected to Google OAuth consent screen
  3. Authorize app for: `gmail.send` + `gmail.readonly`
  4. Redirected to `/auth/gmail/callback`
  5. Exchange code for access/refresh tokens
  6. Tokens stored in `oauth_tokens` table

**Status Display**: Shows connected/disconnected state with email address

---

### 6. **Edge Functions (Placeholder)**
- **`send-sequence-email`**: Ready to integrate with Gmail API
  - Takes email payload
  - Checks for Gmail OAuth tokens
  - Will send via Gmail API
  
- **`gmail-exchange-code`**: OAuth token exchange
  - Takes authorization code from Google
  - Exchanges for access/refresh tokens
  - Returns token details
  
- **`gmail-poll-replies`**: Scheduled monitoring
  - Checks Gmail threads for new replies
  - Updates recipient state to `replied`
  - Creates interaction records

---

## 🔧 Setup & Configuration

### Step 1: Apply Database Schema
```bash
# Run in Supabase SQL Editor
# Copy entire contents of: supabase/setup.sql
# Paste and execute in https://app.supabase.com → SQL Editor
```

This creates:
- All Phase 1 tables (contacts, applications, companies, etc.)
- Phase 2 tables: `sequences`, `sequence_steps`, `sequence_recipients`, `sequence_sends`
- Phase 3 table: `oauth_tokens`
- All RLS policies disabled

### Step 2: Add Test Data
```bash
npx tsx scripts/seed-data.ts
```

Populates with 7 contacts, 5 companies, 5 applications, and sample interactions.

### Step 3: Configure Gmail OAuth (Optional)

To enable Gmail sending, you need to:

1. **Create Google OAuth App**:
   - Go to https://console.developers.google.com
   - Create new project: "Career CRM"
   - Enable APIs: Gmail API, Google+ API
   - Create OAuth 2.0 credential (Web application)
   - Add authorized redirect URI:
     - Development: `http://localhost:8080/auth/gmail/callback`
     - Production: `https://yourdomain.com/auth/gmail/callback`

2. **Set Environment Variables**:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_secret
   FRONTEND_URL=http://localhost:8080
   ```

3. **Deploy Edge Functions**:
   ```bash
   # If using Supabase CLI
   supabase functions deploy send-sequence-email
   supabase functions deploy gmail-exchange-code
   supabase functions deploy gmail-poll-replies
   ```

### Step 4: Start Dev Server
```bash
npm run dev
# Open http://localhost:8080
```

---

## 🎯 Usage Guide

### Creating a Sequence

1. Go to `/sequences`
2. Click "New Sequence"
3. Enter name (e.g., "Anthropic Outreach")
4. Select application to link
5. Click "Create Sequence"

### Adding Email Steps

1. On sequence detail page, click "Email Steps" tab
2. Click "+ Add Step"
3. Choose step type: Initial, Follow-up 1/2/3
4. Enter delay (days to wait after previous step)
5. Write email subject/body with variables:
   ```
   Subject: Hi {{first_name}}, interested in {{role}} at {{company}}?
   Body: Dear {{first_name}},
   
   I came across your profile and thought you'd be great for the
   {{role}} position at {{company}}...
   ```
6. Click "Preview" to see how it looks for different contacts
7. Click "Add Step"

### Enrolling Recipients

1. Go to sequence detail → "Recipients" tab
2. Click "Add Recipients"
3. Search and select contacts (checkboxes)
4. Click "Add Recipients"
5. Contacts now appear in table with `waiting` state

### Sending Emails

**Manual (For Testing)**:
1. Ensure sequence has steps + recipients
2. Click "Send Now" button (top right)
3. Check console to verify emails are being sent
4. Recipient states update automatically

**Scheduled (Production)**:
- Set up Supabase cron job to call `/functions/v1/gmail-poll-replies` every 15 min
- Emails are sent automatically when `next_send_at` time arrives
- Recipient states update based on email responses

---

## 🚀 Next Features to Build

### Phase 3: Gmail Full Integration
- [ ] Integrate Gmail API send with actual SMTP delivery
- [ ] Monitor Gmail threads for replies
- [ ] Auto-detect replies and update recipient state
- [ ] Create interaction records from replies
- [ ] Email delivery tracking (sent, opened, replied)

### Phase 4: CSV Import
- [ ] CSV/Excel file upload
- [ ] Column mapping UI
- [ ] Deduplication engine
- [ ] Batch tagging
- [ ] Import preview & validation

### Phase 5: Analytics
- [ ] Sequence performance dashboard
- [ ] Reply rate by sequence
- [ ] Best performing templates
- [ ] Company response metrics
- [ ] Weekly activity charts

### Phase 6: AI Copilot
- [ ] Email generation from context
- [ ] Template improvement suggestions
- [ ] Personalization hints
- [ ] Follow-up recommendations

---

## 📊 Database Schema

```sql
sequences (id, user_id, name, application_id, status)
├── sequence_steps (sequence_id, step_number, delay_days, template_*)
└── sequence_recipients (sequence_id, contact_id, state, next_send_at)
    └── sequence_sends (recipient_id, step_number, sent_at, subject, body)

oauth_tokens (user_id, provider, access_token, refresh_token, expires_at)
```

**Recipient States**:
- `waiting` - Enrolled, waiting for first send time
- `initial_sent` - Initial email sent, waiting for next step delay
- `followup_1/2/3` - Follow-up sent, state advances per email
- `replied` - Contact replied, stops further sends
- `bounced` - Email bounced, stops sends
- `closed` - All steps completed, sequence finished

---

## 🔍 Testing Checklist

- [ ] Create sequence with 3 email steps
- [ ] Add 3 recipients
- [ ] Preview emails with different contacts
- [ ] Click "Send Now" and check console output
- [ ] Verify recipient states update correctly
- [ ] Test Gmail connection (if OAuth configured)
- [ ] Verify emails appear in Gmail inbox
- [ ] Mark sequence as paused/active
- [ ] Delete sequence
- [ ] Search and filter sequences

---

## 🐛 Common Issues

**"Add Recipients disabled"**
- Solution: Add email steps first (at least initial email)

**No emails sending**
- Check: Sequence status = `active`, recipients = `waiting`, current time >= `next_send_at`
- Check browser console for errors

**Gmail connection fails**
- Verify: Google OAuth credentials in environment
- Check: Redirect URI matches exactly
- Verify: Gmail API enabled in Google Cloud console

---

## 💡 Architecture Notes

1. **Template Rendering**: Happens at send time, not preview
2. **State Machine**: Linear progression, no skipping steps
3. **Delays**: Calculated from previous send time, not enrollment
4. **No Auth**: All users share `00000000-0000-0000-0000-000000000000` ID
5. **Edge Functions**: Stateless, can be called multiple times safely
6. **Cron Jobs**: Set up via Supabase Dashboard under Functions

---

## 📝 Files Created/Modified

**New Components**:
- `AddRecipientsDialog.tsx` - Recipient enrollment dialog
- `TemplatePreview.tsx` - Email preview with variables
- `SequencesPage.tsx` - Main sequences list
- `SequenceDetailPage.tsx` - Sequence editor
- `SettingsPage.tsx` - Settings with Gmail OAuth
- `ImportPage.tsx` - CSV import (stub)

**New Utilities**:
- `src/lib/sequence-utils.ts` - Rendering, sending, scheduling

**New Routes**:
- `/sequences` - List
- `/sequences/:sequenceId` - Detail
- `/settings` - Settings + Gmail OAuth
- `/auth/gmail/callback` - OAuth callback

**New Edge Functions**:
- `send-sequence-email` - Send via Gmail
- `gmail-exchange-code` - OAuth token exchange
- `gmail-poll-replies` - Reply monitoring

**Database Tables**:
- `sequences` - Outreach campaigns
- `sequence_steps` - Email templates per step
- `sequence_recipients` - Contacts enrolled in sequences
- `sequence_sends` - Log of sent emails
- `oauth_tokens` - Gmail/future OAuth tokens

---

## 🎓 Learning Path

If you want to extend or modify:

1. **Add new email step types**: Edit `stepLabels` in SequenceDetailPage
2. **Change send delays**: Modify `delay_days` field in sequence_steps
3. **Customize variables**: Update `renderTemplate()` in sequence-utils.ts
4. **Add recipient actions**: Create new buttons in recipients table
5. **Enable Gmail**: Implement Gmail API calls in send-sequence-email function

---

**Status**: Phase 2 complete! Sequences framework ready for Gmail integration.
