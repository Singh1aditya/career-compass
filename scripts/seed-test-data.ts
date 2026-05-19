// Rich test data for system testing.
// Idempotent: deletes existing rows for DEFAULT_USER_ID before inserting.
// Run: npx tsx scripts/seed-test-data.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SEED_SUPABASE_URL;
if (!supabaseUrl) {
  console.error("Set SEED_SUPABASE_URL env var to your Supabase project URL.");
  process.exit(1);
}
const supabaseKey = process.env.SEED_SUPABASE_KEY;
if (!supabaseKey) {
  console.error("Set SEED_SUPABASE_KEY env var to a service_role key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const USER = "00000000-0000-0000-0000-000000000000";

const companies = [
  {
    name: "Anthropic",
    website: "anthropic.com",
    industry: "AI",
    stage: "growth",
    hiring_signals: "Hiring across all roles",
  },
  {
    name: "OpenAI",
    website: "openai.com",
    industry: "AI",
    stage: "growth",
    hiring_signals: "Series C raise",
  },
  {
    name: "Google",
    website: "google.com",
    industry: "Tech",
    stage: "public",
    hiring_signals: "Always hiring",
  },
  {
    name: "Meta",
    website: "meta.com",
    industry: "Tech",
    stage: "public",
    hiring_signals: "Restructuring",
  },
  {
    name: "Stripe",
    website: "stripe.com",
    industry: "Fintech",
    stage: "growth",
    hiring_signals: "Expansion",
  },
  {
    name: "Vercel",
    website: "vercel.com",
    industry: "DevTools",
    stage: "growth",
    hiring_signals: "Series D",
  },
  {
    name: "Linear",
    website: "linear.app",
    industry: "Productivity",
    stage: "growth",
    hiring_signals: "Series B",
  },
  {
    name: "Figma",
    website: "figma.com",
    industry: "Design",
    stage: "public",
    hiring_signals: "Adobe acquisition",
  },
  {
    name: "Datadog",
    website: "datadoghq.com",
    industry: "Observability",
    stage: "public",
    hiring_signals: "Steady",
  },
  {
    name: "Notion",
    website: "notion.so",
    industry: "Productivity",
    stage: "growth",
    hiring_signals: "AI features ramp",
  },
  {
    name: "Ramp",
    website: "ramp.com",
    industry: "Fintech",
    stage: "growth",
    hiring_signals: "Heavy eng hiring",
  },
  {
    name: "Plaid",
    website: "plaid.com",
    industry: "Fintech",
    stage: "growth",
    hiring_signals: "Quiet",
  },
];

const contacts = [
  {
    name: "Sarah Chen",
    email: "sarah.chen@anthropic.com",
    phone: "+1-555-0101",
    company_name: "Anthropic",
    role: "Hiring Manager",
    contact_type: "recruiter",
    notes: "Met at AI conference 2026. Interested in safety-focused engineers.",
  },
  {
    name: "John Smith",
    email: "john.smith@openai.com",
    phone: "+1-555-0102",
    company_name: "OpenAI",
    role: "Engineering Lead",
    contact_type: "recruiter",
    notes: "Phone screen scheduled for next week",
  },
  {
    name: "Emily Rodriguez",
    email: "emily.r@google.com",
    phone: "+1-555-0103",
    company_name: "Google",
    role: "Technical Recruiter",
    contact_type: "recruiter",
    notes: "Also covers DeepMind",
  },
  {
    name: "Alex Kim",
    email: "alex.kim@meta.com",
    phone: "+1-555-0104",
    company_name: "Meta",
    role: "Director of Engineering",
    contact_type: "referral",
    notes: "Referred by Priya. Strong inside advocate.",
  },
  {
    name: "Lisa Wang",
    email: "lisa.wang@stripe.com",
    phone: "+1-555-0105",
    company_name: "Stripe",
    role: "Engineering Manager",
    contact_type: "recruiter",
    notes: "Payments platform team",
  },
  {
    name: "Michael Johnson",
    email: "michael@techstartup.io",
    phone: "+1-555-0106",
    company_name: "TechStartup Inc",
    role: "Cofounder",
    contact_type: "founder",
    notes: "Pre-seed, looking for founding eng",
  },
  {
    name: "Jessica Lee",
    email: "jessica.lee@anthropic.com",
    phone: "+1-555-0107",
    company_name: "Anthropic",
    role: "HR Specialist",
    contact_type: "recruiter",
    notes: "Coordinator only — route technical questions through Sarah",
  },
  {
    name: "Priya Patel",
    email: "priya@figma.com",
    phone: "+1-555-0108",
    company_name: "Figma",
    role: "Senior Designer",
    contact_type: "colleague",
    notes: "Former coworker at startup",
  },
  {
    name: "David Park",
    email: "david.park@vercel.com",
    phone: "+1-555-0109",
    company_name: "Vercel",
    role: "VP Engineering",
    contact_type: "referral",
    notes: "Warm intro through Alex",
  },
  {
    name: "Maria Garcia",
    email: "maria.g@linear.app",
    phone: "+1-555-0110",
    company_name: "Linear",
    role: "Recruiter",
    contact_type: "recruiter",
    notes: "Reached out cold on LinkedIn",
  },
  {
    name: "Tom Wilson",
    email: "tom@datadoghq.com",
    phone: "+1-555-0111",
    company_name: "Datadog",
    role: "Staff Engineer",
    contact_type: "colleague",
    notes: "Met at observability meetup",
  },
  {
    name: "Rachel Brown",
    email: "rachel.brown@notion.so",
    phone: "+1-555-0112",
    company_name: "Notion",
    role: "Recruiter",
    contact_type: "recruiter",
    notes: "AI-team focused",
  },
  {
    name: "Daniel Liu",
    email: "daniel@ramp.com",
    phone: "+1-555-0113",
    company_name: "Ramp",
    role: "Engineering Manager",
    contact_type: "recruiter",
    notes: "Aggressive pipeline",
  },
  {
    name: "Sophie Martin",
    email: "sophie@plaid.com",
    phone: "+1-555-0114",
    company_name: "Plaid",
    role: "Senior Engineer",
    contact_type: "colleague",
    notes: "",
  },
  {
    name: "James Taylor",
    email: "james.taylor@stripe.com",
    phone: "+1-555-0115",
    company_name: "Stripe",
    role: "Director",
    contact_type: "referral",
    notes: "Hiring for Issuing team",
  },
  {
    name: "Olivia Davis",
    email: "olivia@anthropic.com",
    phone: "+1-555-0116",
    company_name: "Anthropic",
    role: "ML Researcher",
    contact_type: "colleague",
    notes: "Met at NeurIPS",
  },
  {
    name: "Ben Anderson",
    email: "ben@indiehacker.dev",
    phone: null,
    company_name: "Indie",
    role: "Solo founder",
    contact_type: "other",
    notes: "Twitter mutual",
  },
  {
    name: "Nina Hoffman",
    email: "nina@workflow.ai",
    phone: "+1-555-0118",
    company_name: "Workflow AI",
    role: "CTO",
    contact_type: "founder",
    notes: "Hiring 5 engineers in Q3",
  },
  {
    name: "Carlos Mendez",
    email: null,
    phone: "+1-555-0119",
    company_name: "Stealth",
    role: "Cofounder",
    contact_type: "founder",
    notes: "No website yet",
  },
  {
    name: "Yuki Tanaka",
    email: "yuki@google.com",
    phone: "+1-555-0120",
    company_name: "Google",
    role: "Staff Engineer",
    contact_type: "referral",
    notes: "Mutual connection through Emily",
  },
];

// Spread across all 7 statuses to test Kanban
const applications = [
  {
    company_name: "Notion",
    role_title: "Senior Software Engineer, AI",
    status: "wishlist",
    applied_date: null,
    source: "LinkedIn",
    resume_version: "v3",
    notes: "Want to apply when next role opens",
  },
  {
    company_name: "Linear",
    role_title: "Senior Backend Engineer",
    status: "wishlist",
    applied_date: null,
    source: "Job board",
    resume_version: "v3",
    notes: "Reach out to Maria",
  },
  {
    company_name: "Anthropic",
    role_title: "Senior Software Engineer",
    status: "applied",
    applied_date: "2026-04-15",
    source: "Referral - Priya",
    resume_version: "v2",
    notes: "Resume tailored for AI safety",
  },
  {
    company_name: "Vercel",
    role_title: "Platform Engineer",
    status: "applied",
    applied_date: "2026-04-22",
    source: "Cold outreach",
    resume_version: "v2",
    notes: "Mentioned Next.js contributions",
  },
  {
    company_name: "Ramp",
    role_title: "Senior Engineer, Card Platform",
    status: "applied",
    applied_date: "2026-05-01",
    source: "LinkedIn",
    resume_version: "v3",
    notes: "",
  },
  {
    company_name: "OpenAI",
    role_title: "ML Engineer",
    status: "screening",
    applied_date: "2026-04-20",
    source: "Job board",
    resume_version: "v2",
    notes: "Recruiter screen passed",
  },
  {
    company_name: "Stripe",
    role_title: "Senior Engineer, Issuing",
    status: "screening",
    applied_date: "2026-04-18",
    source: "Referral - James",
    resume_version: "v3",
    notes: "Hiring manager screen scheduled",
  },
  {
    company_name: "Datadog",
    role_title: "Staff Software Engineer",
    status: "interviewing",
    applied_date: "2026-04-05",
    source: "Cold outreach",
    resume_version: "v2",
    notes: "Onsite scheduled for next week. 5 rounds.",
  },
  {
    company_name: "Figma",
    role_title: "Senior Frontend Engineer",
    status: "interviewing",
    applied_date: "2026-04-08",
    source: "Referral - Priya",
    resume_version: "v2",
    notes: "System design round done. Behavioral remaining.",
  },
  {
    company_name: "Stripe",
    role_title: "Principal Engineer",
    status: "offer",
    applied_date: "2026-04-01",
    source: "Referral - James",
    resume_version: "v3",
    notes: "Offer received! Negotiating equity.",
  },
  {
    company_name: "Meta",
    role_title: "Engineering Manager",
    status: "rejected",
    applied_date: "2026-03-10",
    source: "Cold outreach",
    resume_version: "v1",
    notes: "Rejected after final round",
  },
  {
    company_name: "Google",
    role_title: "Senior PM",
    status: "rejected",
    applied_date: "2026-03-25",
    source: "LinkedIn",
    resume_version: "v1",
    notes: "Not enough PM experience",
  },
  {
    company_name: "Plaid",
    role_title: "Engineering Manager",
    status: "withdrawn",
    applied_date: "2026-03-15",
    source: "Recruiter outreach",
    resume_version: "v1",
    notes: "Withdrew - decided to focus on Stripe",
  },
];

const tags = [
  { name: "hot_lead", color: "#EF4444" },
  { name: "follow_up", color: "#F59E0B" },
  { name: "interested", color: "#10B981" },
  { name: "not_interested", color: "#6B7280" },
  { name: "warm_intro", color: "#3B82F6" },
];

async function clearExisting() {
  console.log("🧹 Clearing existing data for test user...");
  // Order matters due to FKs
  await supabase.from("processed_emails").delete().eq("user_id", USER);
  await supabase.from("follow_ups").delete().eq("user_id", USER);
  await supabase.from("interactions").delete().eq("user_id", USER);
  await supabase.from("notes").delete().eq("user_id", USER);
  await supabase
    .from("contact_tags")
    .delete()
    .neq("contact_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("tags").delete().eq("user_id", USER);
  await supabase.from("applications").delete().eq("user_id", USER);
  await supabase.from("contacts").delete().eq("user_id", USER);
  await supabase.from("companies").delete().eq("user_id", USER);
  console.log("   done.\n");
}

async function seed() {
  await clearExisting();

  console.log(`📦 Inserting ${companies.length} companies...`);
  const { data: companiesData, error: cErr } = await supabase
    .from("companies")
    .insert(companies.map((c) => ({ ...c, user_id: USER })))
    .select();
  if (cErr) throw cErr;
  console.log(`   ✓ ${companiesData?.length}\n`);

  console.log(`👥 Inserting ${contacts.length} contacts...`);
  const { data: contactsData, error: ctErr } = await supabase
    .from("contacts")
    .insert(contacts.map((c) => ({ ...c, user_id: USER, status: "active" })))
    .select();
  if (ctErr) throw ctErr;
  console.log(`   ✓ ${contactsData?.length}\n`);

  console.log(`💼 Inserting ${applications.length} applications...`);
  const { data: appsData, error: aErr } = await supabase
    .from("applications")
    .insert(applications.map((a) => ({ ...a, user_id: USER })))
    .select();
  if (aErr) throw aErr;
  console.log(`   ✓ ${appsData?.length}\n`);

  console.log(`🏷  Inserting ${tags.length} tags...`);
  const { data: tagsData, error: tErr } = await supabase
    .from("tags")
    .insert(tags.map((t) => ({ ...t, user_id: USER })))
    .select();
  if (tErr) throw tErr;
  console.log(`   ✓ ${tagsData?.length}\n`);

  console.log(`💬 Inserting interactions...`);
  const interactions = [
    {
      contact_id: contactsData?.[0]?.id,
      type: "email",
      direction: "outbound",
      summary: "Initial outreach about Anthropic role",
      date: "2026-05-01",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[1]?.id,
      type: "call",
      direction: "inbound",
      summary: "Phone screen — went well, advancing to onsite",
      date: "2026-05-03",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[2]?.id,
      type: "meeting",
      direction: "outbound",
      summary: "Coffee chat at Google campus",
      date: "2026-05-05",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[4]?.id,
      type: "email",
      direction: "inbound",
      summary: "Lisa replied about Issuing team role",
      date: "2026-05-04",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[8]?.id,
      type: "linkedin",
      direction: "outbound",
      summary: "Sent a note about Vercel platform team",
      date: "2026-04-28",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[14]?.id,
      type: "call",
      direction: "inbound",
      summary: "James — offer discussion",
      date: "2026-05-06",
      user_id: USER,
      application_id: appsData?.find(
        (a: { role_title: string }) => a.role_title === "Principal Engineer",
      )?.id,
    },
  ];
  const { data: intData, error: iErr } = await supabase
    .from("interactions")
    .insert(interactions.filter((i) => i.contact_id))
    .select();
  if (iErr) throw iErr;
  console.log(`   ✓ ${intData?.length}\n`);

  console.log(`📝 Inserting notes...`);
  const notes = [
    {
      contact_id: contactsData?.[0]?.id,
      content: "Sarah is the most promising contact at Anthropic. Loop her in early on any leads.",
      user_id: USER,
    },
    {
      application_id: appsData?.[7]?.id,
      content:
        "Datadog onsite: 1) coding (90m) 2) system design 3) behavioral 4) team match 5) skip-level",
      user_id: USER,
    },
    {
      application_id: appsData?.find(
        (a: { role_title: string }) => a.role_title === "Principal Engineer",
      )?.id,
      content:
        "Stripe offer breakdown: $280k base, $400k equity over 4 years, $50k signing. Pushing on equity.",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[8]?.id,
      content: "David said Vercel is reorganizing platform team — hiring slows mid-Q3.",
      user_id: USER,
    },
  ];
  const { data: notesData, error: nErr } = await supabase
    .from("notes")
    .insert(notes.filter((n) => n.contact_id || n.application_id))
    .select();
  if (nErr) throw nErr;
  console.log(`   ✓ ${notesData?.length}\n`);

  console.log(`📅 Inserting follow-ups...`);
  const followUps = [
    {
      contact_id: contactsData?.[0]?.id,
      due_date: "2026-05-10",
      status: "pending",
      description: "Follow up on Anthropic application status",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[1]?.id,
      due_date: "2026-05-08",
      status: "completed",
      description: "Confirm OpenAI onsite date",
      user_id: USER,
    },
    {
      application_id: appsData?.[2]?.id,
      due_date: "2026-05-15",
      status: "pending",
      description: "Send thank-you email to Anthropic",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[4]?.id,
      due_date: "2026-05-04",
      status: "pending",
      description: "Reply to Lisa about Issuing team",
      user_id: USER,
    },
    {
      application_id: appsData?.[7]?.id,
      due_date: "2026-05-09",
      status: "pending",
      description: "Prep for Datadog onsite",
      user_id: USER,
    },
    {
      contact_id: contactsData?.[12]?.id,
      due_date: "2026-05-12",
      status: "pending",
      description: "Schedule call with Daniel at Ramp",
      user_id: USER,
    },
  ];
  const { data: fuData, error: fErr } = await supabase
    .from("follow_ups")
    .insert(followUps.filter((f) => f.contact_id || f.application_id))
    .select();
  if (fErr) throw fErr;
  console.log(`   ✓ ${fuData?.length}\n`);

  console.log("🎉 Test data seeded successfully!\n");
  console.log("Summary:");
  console.log(`  • ${companiesData?.length} companies`);
  console.log(`  • ${contactsData?.length} contacts`);
  console.log(`  • ${appsData?.length} applications across 7 statuses`);
  console.log(`  • ${tagsData?.length} tags`);
  console.log(`  • ${intData?.length} interactions`);
  console.log(`  • ${notesData?.length} notes`);
  console.log(`  • ${fuData?.length} follow-ups`);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
