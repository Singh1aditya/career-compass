import { describe, it, expect } from "vitest";
import { totalResultCount, emptyResults } from "@/lib/search";

describe("emptyResults", () => {
  it("has all four keys", () => {
    expect(emptyResults).toHaveProperty("contacts");
    expect(emptyResults).toHaveProperty("applications");
    expect(emptyResults).toHaveProperty("companies");
    expect(emptyResults).toHaveProperty("notes");
  });

  it("all arrays are empty", () => {
    expect(emptyResults.contacts).toHaveLength(0);
    expect(emptyResults.applications).toHaveLength(0);
    expect(emptyResults.companies).toHaveLength(0);
    expect(emptyResults.notes).toHaveLength(0);
  });
});

describe("totalResultCount", () => {
  it("returns 0 for emptyResults", () => {
    expect(totalResultCount(emptyResults)).toBe(0);
  });

  it("sums counts from all four categories", () => {
    const results = {
      contacts: [{ id: "1", name: "A", email: null, company_name: null, contact_type: "other" }],
      applications: [
        { id: "2", role_title: "SWE", company_name: "X", status: "applied" },
        { id: "3", role_title: "PM", company_name: "Y", status: "applied" },
      ],
      companies: [{ id: "4", name: "Corp", industry: null }],
      notes: [
        { id: "5", content: "note1", contact_id: "1", application_id: null },
        { id: "6", content: "note2", contact_id: null, application_id: "2" },
        { id: "7", content: "note3", contact_id: null, application_id: null },
      ],
    };
    expect(totalResultCount(results)).toBe(7);
  });

  it("handles single category having results", () => {
    const results = {
      ...emptyResults,
      companies: [{ id: "1", name: "Acme", industry: "Tech" }],
    };
    expect(totalResultCount(results)).toBe(1);
  });
});
