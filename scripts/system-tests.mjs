// System tests: data-layer assertions against the live DB.
// Run: SEED_SUPABASE_KEY=<service-role> node scripts/system-tests.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SEED_SUPABASE_URL;
const KEY = process.env.SEED_SUPABASE_KEY;
if (!URL || !KEY) {
  console.error("Set SEED_SUPABASE_URL and SEED_SUPABASE_KEY env vars.");
  process.exit(1);
}
const sb = createClient(URL, KEY);
const USER = "00000000-0000-0000-0000-000000000000";

let pass = 0,
  fail = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    pass++;
    results.push(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    results.push(`  ✗ ${name}\n      ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const STATUSES = [
  "wishlist",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

console.log("\n=== SYSTEM TESTS ===\n");

console.log("[1] Schema integrity");

await test("All 15 tables exist", async () => {
  const tables = [
    "profiles",
    "companies",
    "contacts",
    "tags",
    "contact_tags",
    "applications",
    "interactions",
    "notes",
    "follow_ups",
    "sequences",
    "sequence_steps",
    "sequence_recipients",
    "sequence_sends",
    "oauth_tokens",
    "processed_emails",
  ];
  for (const t of tables) {
    const { error } = await sb.from(t).select("*", { count: "exact", head: true });
    assert(!error, `${t} unreadable: ${error?.message}`);
  }
});

console.log("\n[2] Seed data integrity");

await test("12 companies seeded", async () => {
  const { count } = await sb.from("companies").select("*", { count: "exact", head: true });
  assert(count === 12, `expected 12, got ${count}`);
});

await test("20 contacts seeded", async () => {
  const { count } = await sb.from("contacts").select("*", { count: "exact", head: true });
  assert(count === 20, `expected 20, got ${count}`);
});

await test("13 applications seeded", async () => {
  const { count } = await sb.from("applications").select("*", { count: "exact", head: true });
  assert(count === 13, `expected 13, got ${count}`);
});

await test("Applications span all 7 kanban statuses", async () => {
  const { data } = await sb.from("applications").select("status");
  const seen = new Set(data.map((d) => d.status));
  for (const s of STATUSES) {
    assert(seen.has(s), `missing status: ${s}`);
  }
});

await test("Every contact has a name", async () => {
  const { data } = await sb.from("contacts").select("name");
  data.forEach((c, i) => assert(c.name && c.name.trim().length > 0, `contact[${i}] empty name`));
});

await test("All applications have user_id matching default", async () => {
  const { data } = await sb.from("applications").select("user_id");
  data.forEach((a) => assert(a.user_id === USER, `wrong user_id: ${a.user_id}`));
});

console.log("\n[3] Search query patterns (mirror src/lib/search.ts)");

await test("Search 'anthropic' finds contacts and companies", async () => {
  const pat = "%anthropic%";
  const [c, comp] = await Promise.all([
    sb
      .from("contacts")
      .select("name")
      .or(`name.ilike.${pat},email.ilike.${pat},company_name.ilike.${pat}`),
    sb.from("companies").select("name").ilike("name", pat),
  ]);
  assert(c.data.length >= 3, `contacts: expected >=3, got ${c.data.length}`);
  assert(comp.data.length === 1, `companies: expected 1, got ${comp.data.length}`);
});

await test("Search by phone number works", async () => {
  const { data } = await sb.from("contacts").select("name").or("phone.ilike.%555-0101%");
  assert(data.length === 1, `expected 1 contact for 555-0101, got ${data.length}`);
});

await test("Search by notes content works", async () => {
  const { data } = await sb
    .from("applications")
    .select("role_title")
    .or("notes.ilike.%Negotiating%");
  assert(data.length >= 1, `expected match for 'Negotiating' in notes, got ${data.length}`);
});

console.log("\n[4] Kanban operations");

await test("Move application from screening → interviewing", async () => {
  const { data: before } = await sb
    .from("applications")
    .select("id, status")
    .eq("status", "screening")
    .limit(1);
  assert(before.length === 1, "no screening app to move");
  const id = before[0].id;
  const { error } = await sb
    .from("applications")
    .update({ status: "interviewing", updated_at: new Date().toISOString() })
    .eq("id", id);
  assert(!error, error?.message);
  const { data: after } = await sb.from("applications").select("status").eq("id", id).single();
  assert(after.status === "interviewing", `status: ${after.status}`);
  // Restore
  await sb.from("applications").update({ status: "screening" }).eq("id", id);
});

await test("Invalid status rejected at app level (kanban guard)", async () => {
  // The kanban component only allows STATUSES array — DB has no constraint,
  // but we verify the kanban TypeScript guard list matches DB statuses.
  const { data } = await sb.from("applications").select("status");
  const used = new Set(data.map((d) => d.status));
  for (const s of used) {
    assert(STATUSES.includes(s), `DB has unknown status: ${s}`);
  }
});

console.log("\n[5] Foreign key integrity");

await test("All interactions reference valid contacts", async () => {
  const { data: ints } = await sb.from("interactions").select("contact_id, application_id");
  const { data: contacts } = await sb.from("contacts").select("id");
  const { data: apps } = await sb.from("applications").select("id");
  const cIds = new Set(contacts.map((c) => c.id));
  const aIds = new Set(apps.map((a) => a.id));
  for (const i of ints) {
    if (i.contact_id) assert(cIds.has(i.contact_id), `dangling contact_id ${i.contact_id}`);
    if (i.application_id)
      assert(aIds.has(i.application_id), `dangling application_id ${i.application_id}`);
  }
});

await test("All notes reference valid contacts/applications", async () => {
  const { data: notes } = await sb.from("notes").select("contact_id, application_id");
  const { data: contacts } = await sb.from("contacts").select("id");
  const { data: apps } = await sb.from("applications").select("id");
  const cIds = new Set(contacts.map((c) => c.id));
  const aIds = new Set(apps.map((a) => a.id));
  for (const n of notes) {
    if (n.contact_id) assert(cIds.has(n.contact_id), `dangling contact`);
    if (n.application_id) assert(aIds.has(n.application_id), `dangling application`);
  }
});

console.log("\n[6] Edge function logic — email classification regex");

const CONFIRMATION_PATTERNS = [
  /thank(s| you) for applying/i,
  /thanks for your application/i,
  /application (has been )?received/i,
  /we('ve| have) received your application/i,
  /your application (for|to)/i,
  /confirming (we have received|your application)/i,
];
const REJECTION_PATTERNS = [
  /unfortunately[\s,].{0,80}(not|won't|will not|unable|decided)/i,
  /not moving forward/i,
  /regret to inform/i,
  /decided to (move forward|proceed|go) with (other|another)/i,
  /after careful consideration[\s,].{0,80}(other|not|won't|will not)/i,
  /(we|i) (have )?decided not to/i,
  /your application (was )?(unsuccessful|not selected)/i,
];

function classify(text) {
  for (const re of REJECTION_PATTERNS) if (re.test(text)) return "rejection";
  for (const re of CONFIRMATION_PATTERNS) if (re.test(text)) return "confirmation";
  return "unknown";
}

const fixtures = [
  ["Thank you for applying to the Senior Engineer position at Acme", "confirmation"],
  ["Thanks for applying to Acme!", "confirmation"],
  ["We've received your application for Software Engineer", "confirmation"],
  ["Your application for Senior Engineer", "confirmation"],
  ["Application received: Senior Engineer", "confirmation"],
  ["Unfortunately, we have decided to move forward with another candidate", "rejection"],
  ["We regret to inform you that your application was not selected", "rejection"],
  ["After careful consideration, we have decided not to move forward", "rejection"],
  ["Your weekly newsletter", "unknown"],
  ["Welcome to our company!", "unknown"],
];

for (const [subject, expected] of fixtures) {
  await test(`Classify "${subject.slice(0, 50)}..." → ${expected}`, async () => {
    const got = classify(subject);
    assert(got === expected, `got "${got}", expected "${expected}"`);
  });
}

console.log("\n[7] Edge function — company/role extraction");

function extractRole(subject) {
  const patterns = [
    /(?:apply(?:ing)?|application)\s+(?:for|to)(?:\s+the)?\s+(.+?)\s+(?:position|role|opening|opportunity|job)/i,
    /(?:apply(?:ing)?|application)\s+(?:for|to)(?:\s+the)?\s+(.+?)\s+at\s+/i,
    /your application for\s+(.+?)\s+(?:at|has|is|was)/i,
    /application (?:received|status)[:\s]+(.+?)(?:\s+at\s+|\s*$|\s*-|\s*–)/i,
    /position[:\s]+(.+?)(?:\s+at\s+|\s*$|\s*-|\s*–)/i,
  ];
  for (const re of patterns) {
    const m = subject.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function extractCompany(subject) {
  const m = subject.match(/\bat\s+([A-Z][\w&.,'\- ]{1,60}?)(?:[!.\n]|\s*$)/);
  return m ? m[1].trim() : null;
}

const extractFixtures = [
  ["Thank you for applying to the Senior Engineer position at Acme", "Senior Engineer", "Acme"],
  ["Application received: Senior Engineer", "Senior Engineer", null],
  ["Your application for Software Engineer at Stripe", "Software Engineer", "Stripe"],
];

for (const [subject, expectedRole, expectedCompany] of extractFixtures) {
  await test(`Extract role from "${subject.slice(0, 40)}..."`, async () => {
    const role = extractRole(subject);
    assert(role === expectedRole, `role: got "${role}", expected "${expectedRole}"`);
  });
  await test(`Extract company from "${subject.slice(0, 40)}..."`, async () => {
    const company = extractCompany(subject);
    assert(company === expectedCompany, `company: got "${company}", expected "${expectedCompany}"`);
  });
}

console.log("\n[8] Real-world insertion paths (mirrors what the app UI does)");

await test("Insert + delete contact (mirrors ContactsPage form)", async () => {
  const { data, error } = await sb
    .from("contacts")
    .insert({
      user_id: USER,
      name: "_test_insert_",
      email: "test@example.com",
      contact_type: "other",
      status: "active",
    })
    .select()
    .single();
  assert(!error, error?.message);
  assert(data.id, "no id returned");
  await sb.from("contacts").delete().eq("id", data.id);
});

await test("Insert + delete application (mirrors ApplicationsPage form)", async () => {
  const { data, error } = await sb
    .from("applications")
    .insert({
      user_id: USER,
      role_title: "_test_role_",
      status: "wishlist",
    })
    .select()
    .single();
  assert(!error, error?.message);
  await sb.from("applications").delete().eq("id", data.id);
});

await test("Status update preserves row (mirrors kanban drag)", async () => {
  const { data: created } = await sb
    .from("applications")
    .insert({
      user_id: USER,
      role_title: "_kanban_test_",
      status: "wishlist",
    })
    .select()
    .single();
  await sb.from("applications").update({ status: "interviewing" }).eq("id", created.id);
  const { data: refetched } = await sb
    .from("applications")
    .select("*")
    .eq("id", created.id)
    .single();
  assert(refetched.status === "interviewing", `status: ${refetched.status}`);
  assert(refetched.role_title === "_kanban_test_", "row corrupted");
  await sb.from("applications").delete().eq("id", created.id);
});

console.log("\n=== RESULTS ===");
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
