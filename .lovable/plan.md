
# Career CRM — Personal Networking & Job Search Tracker

A full-featured personal CRM to manage contacts, job applications, companies, follow-ups, notes, and outreach — all from a single sidebar-driven interface with Supabase auth.

---

## Authentication

- Email/password + Google sign-in
- Profile table auto-created on signup
- All routes behind an `_authenticated` layout guard

---

## Navigation & Layout

Collapsible sidebar with these sections:

- **Dashboard** — daily action queue, pending follow-ups, pipeline summary stats
- **Contacts** — list/grid of all contacts with tags, filters, search
- **Applications** — kanban-style or table view of job applications by stage
- **Companies** — startup watchlist and company tracker
- **Follow-ups** — upcoming and overdue reminders
- **Notes** — global search across all notes

---

## Database Schema

**profiles** — user display name, avatar

**contacts** — name, email, phone, company, role, type (recruiter/founder/referral/other), tags (array), status (active/archived), notes, created_at

**companies** — name, website, industry, stage (startup/growth/enterprise), hiring_signals, watchlist (boolean), notes

**applications** — company_id, role_title, status (wishlist/applied/screening/interviewing/offer/rejected/withdrawn), applied_date, resume_version, source, notes

**interactions** — contact_id, application_id (optional), type (email/call/meeting/linkedin/other), direction (inbound/outbound), summary, date

**follow_ups** — contact_id, application_id (optional), due_date, description, status (pending/completed/skipped), priority (low/medium/high)

**notes** — contact_id (optional), company_id (optional), application_id (optional), content, created_at

**tags** — name, color (for flexible tag management)

**contact_tags** — contact_id, tag_id (join table)

All tables have `user_id` with RLS so each user sees only their own data.

---

## Key Features

### Dashboard
- Today's action queue: overdue + due-today follow-ups sorted by priority
- Pipeline summary: count of applications by stage
- Recent interactions timeline
- Quick-add buttons for contacts, applications, and follow-ups

### Contacts
- Table view with search, tag filter, status filter, type filter
- Contact detail page showing: info, all linked interactions, applications, notes, follow-ups
- Quick-add contact dialog
- Archive/reopen contacts
- Tag management (add/remove/create tags inline)

### Applications
- Table view with stage filter, company filter, date range
- Application detail linking to company and contacts involved
- Track resume version used
- Multiple applications per company supported
- Stage history tracked via interactions

### Companies
- Watchlist toggle, hiring signal notes
- See all applications and contacts linked to a company
- Industry/stage filters

### Follow-ups & Reminders
- List view sorted by due date, grouped by overdue/today/upcoming
- Mark complete, skip, or snooze (reschedule)
- Auto-suggested follow-ups after logging an outreach interaction (user confirms)

### Interactions / Outreach History
- Log interactions from contact or application detail pages
- Full chronological history per contact
- Direction tracking (inbound/outbound)

### Global Search
- Search across contacts (name, email, company), applications (role, company), and notes (content)
- Results grouped by type with quick navigation

---

## Technical Details

- Supabase for database + auth (Lovable Cloud)
- TanStack Router file-based routes with sidebar layout
- TanStack Query for data fetching and caching
- Server functions with `requireSupabaseAuth` middleware for all data access
- Shadcn UI components throughout (tables, dialogs, badges, cards, tabs)
- Responsive design — sidebar collapses on mobile
