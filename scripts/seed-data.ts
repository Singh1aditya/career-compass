import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xmkbvmyemtnfgoxtgzug.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_qjoJTUkOql2n3nxh5Aequg_vQZuqGAf";

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

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
    hiring_signals: "Series C",
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
    hiring_signals: "Expansion phase",
  },
];

const contacts = [
  {
    name: "Sarah Chen",
    email: "sarah@anthropic.com",
    phone: "+1-555-0101",
    company_name: "Anthropic",
    role: "Hiring Manager",
    contact_type: "recruiter",
  },
  {
    name: "John Smith",
    email: "john@openai.com",
    phone: "+1-555-0102",
    company_name: "OpenAI",
    role: "Engineering Lead",
    contact_type: "recruiter",
  },
  {
    name: "Emily Rodriguez",
    email: "emily@google.com",
    phone: "+1-555-0103",
    company_name: "Google",
    role: "Technical Recruiter",
    contact_type: "recruiter",
  },
  {
    name: "Alex Kim",
    email: "alex@meta.com",
    phone: "+1-555-0104",
    company_name: "Meta",
    role: "Founder Introduction",
    contact_type: "referral",
  },
  {
    name: "Lisa Wang",
    email: "lisa@stripe.com",
    phone: "+1-555-0105",
    company_name: "Stripe",
    role: "Engineering Manager",
    contact_type: "recruiter",
  },
  {
    name: "Michael Johnson",
    email: "michael@tech-startup.io",
    phone: "+1-555-0106",
    company_name: "TechStartup Inc",
    role: "Cofounder",
    contact_type: "founder",
  },
  {
    name: "Jessica Lee",
    email: "jessica@example.com",
    phone: "+1-555-0107",
    company_name: "Anthropic",
    role: "HR Specialist",
    contact_type: "recruiter",
  },
];

const applications = [
  {
    company_name: "Anthropic",
    role_title: "Senior Software Engineer",
    status: "applied",
    applied_date: "2026-04-15",
    source: "referral",
    resume_version: "v2",
  },
  {
    company_name: "OpenAI",
    role_title: "ML Engineer",
    status: "interview",
    applied_date: "2026-04-20",
    source: "job_board",
    resume_version: "v2",
  },
  {
    company_name: "Google",
    role_title: "Product Manager",
    status: "wishlist",
    applied_date: null,
    source: null,
    resume_version: "v1",
  },
  {
    company_name: "Meta",
    role_title: "Engineering Manager",
    status: "rejected",
    applied_date: "2026-03-10",
    source: "cold_outreach",
    resume_version: "v1",
  },
  {
    company_name: "Stripe",
    role_title: "Principal Engineer",
    status: "offer",
    applied_date: "2026-04-01",
    source: "referral",
    resume_version: "v3",
  },
];

async function seedData() {
  console.log("🌱 Starting to seed data...\n");

  try {
    // Add companies
    console.log("Adding companies...");
    const { data: companiesData, error: companiesError } = await supabase
      .from("companies")
      .insert(companies.map((c) => ({ ...c, user_id: DEFAULT_USER_ID })))
      .select();

    if (companiesError) throw companiesError;
    console.log(`✅ Added ${companiesData?.length || 0} companies\n`);

    // Add contacts
    console.log("Adding contacts...");
    const { data: contactsData, error: contactsError } = await supabase
      .from("contacts")
      .insert(contacts.map((c) => ({ ...c, user_id: DEFAULT_USER_ID, status: "active" })))
      .select();

    if (contactsError) throw contactsError;
    console.log(`✅ Added ${contactsData?.length || 0} contacts\n`);

    // Add applications
    console.log("Adding applications...");
    const { data: applicationsData, error: applicationsError } = await supabase
      .from("applications")
      .insert(applications.map((a) => ({ ...a, user_id: DEFAULT_USER_ID })))
      .select();

    if (applicationsError) throw applicationsError;
    console.log(`✅ Added ${applicationsData?.length || 0} applications\n`);

    // Add tags
    console.log("Adding tags...");
    const tags = [
      { name: "hot_lead", color: "#EF4444", user_id: DEFAULT_USER_ID },
      { name: "follow_up", color: "#F59E0B", user_id: DEFAULT_USER_ID },
      { name: "interested", color: "#10B981", user_id: DEFAULT_USER_ID },
      { name: "not_interested", color: "#6B7280", user_id: DEFAULT_USER_ID },
    ];
    const { data: tagsData, error: tagsError } = await supabase.from("tags").insert(tags).select();

    if (tagsError) throw tagsError;
    console.log(`✅ Added ${tagsData?.length || 0} tags\n`);

    // Add some interactions
    console.log("Adding interactions...");
    const interactions = [
      {
        contact_id: contactsData?.[0]?.id,
        type: "email",
        direction: "outbound",
        summary: "Initial outreach",
        date: "2026-05-01",
        user_id: DEFAULT_USER_ID,
      },
      {
        contact_id: contactsData?.[1]?.id,
        type: "call",
        direction: "inbound",
        summary: "Phone screen discussion",
        date: "2026-05-03",
        user_id: DEFAULT_USER_ID,
      },
      {
        contact_id: contactsData?.[2]?.id,
        type: "meeting",
        direction: "outbound",
        summary: "Coffee chat",
        date: "2026-05-05",
        user_id: DEFAULT_USER_ID,
      },
    ];
    const { data: interactionsData, error: interactionsError } = await supabase
      .from("interactions")
      .insert(interactions.filter((i) => i.contact_id))
      .select();

    if (interactionsError) throw interactionsError;
    console.log(`✅ Added ${interactionsData?.length || 0} interactions\n`);

    // Add some follow-ups
    console.log("Adding follow-ups...");
    const followUps = [
      {
        contact_id: contactsData?.[0]?.id,
        due_date: "2026-05-10",
        status: "pending",
        description: "Follow up on initial email",
        user_id: DEFAULT_USER_ID,
      },
      {
        contact_id: contactsData?.[1]?.id,
        due_date: "2026-05-08",
        status: "completed",
        description: "Schedule next call",
        user_id: DEFAULT_USER_ID,
      },
      {
        application_id: applicationsData?.[0]?.id,
        due_date: "2026-05-15",
        status: "pending",
        description: "Send thank you email",
        user_id: DEFAULT_USER_ID,
      },
    ];
    const { data: followUpsData, error: followUpsError } = await supabase
      .from("follow_ups")
      .insert(followUps.filter((f) => f.contact_id || f.application_id))
      .select();

    if (followUpsError) throw followUpsError;
    console.log(`✅ Added ${followUpsData?.length || 0} follow-ups\n`);

    console.log("🎉 Data seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedData();
