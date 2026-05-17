import { describe, it, expect } from "vitest";
import {
  detectColumnMappings,
  mapRowToContact,
  findDuplicates,
  type CSVRow,
  type ContactPreview,
} from "@/lib/csv-utils";

describe("detectColumnMappings", () => {
  it("maps 'Name' to name", () => {
    const m = detectColumnMappings(["Name"]);
    expect(m["Name"]).toBe("name");
  });

  it("maps 'Email Address' to email", () => {
    const m = detectColumnMappings(["Email Address"]);
    expect(m["Email Address"]).toBe("email");
  });

  it("maps 'Phone Number' to phone", () => {
    const m = detectColumnMappings(["Phone Number"]);
    expect(m["Phone Number"]).toBe("phone");
  });

  it("maps 'Company' to company_name", () => {
    const m = detectColumnMappings(["Company"]);
    expect(m["Company"]).toBe("company_name");
  });

  it("maps 'Job Title' to role", () => {
    const m = detectColumnMappings(["Job Title"]);
    expect(m["Job Title"]).toBe("role");
  });

  it("maps unknown column to null", () => {
    const m = detectColumnMappings(["XYZ_Unknown_Field"]);
    expect(m["XYZ_Unknown_Field"]).toBeNull();
  });

  it("handles multiple columns at once", () => {
    const m = detectColumnMappings(["Full Name", "Email", "Notes"]);
    expect(m["Full Name"]).toBe("name");
    expect(m["Email"]).toBe("email");
    expect(m["Notes"]).toBe("notes");
  });
});

describe("mapRowToContact", () => {
  const row: CSVRow = {
    Name: "Alice Smith",
    Email: "alice@example.com",
    Company: "Acme",
  };

  const mapping = {
    Name: "name",
    Email: "email",
    Company: "company_name",
  };

  it("maps fields correctly", () => {
    const c = mapRowToContact(row, mapping);
    expect(c.name).toBe("Alice Smith");
    expect(c.email).toBe("alice@example.com");
    expect(c.company_name).toBe("Acme");
  });

  it("defaults contact_type to 'other'", () => {
    const c = mapRowToContact(row, mapping);
    expect(c.contact_type).toBe("other");
  });

  it("falls back to email when name is empty", () => {
    const emptyName: CSVRow = { Name: "", Email: "bob@test.com", Company: "" };
    const c = mapRowToContact(emptyName, mapping);
    expect(c.name).toBe("bob@test.com");
  });

  it("falls back to 'Unnamed Contact' when both name and email are empty", () => {
    const empty: CSVRow = { Name: "", Email: "", Company: "" };
    const c = mapRowToContact(empty, mapping);
    expect(c.name).toBe("Unnamed Contact");
  });
});

describe("findDuplicates", () => {
  const contacts: ContactPreview[] = [
    { name: "Alice", email: "alice@example.com", contact_type: "other" },
    { name: "Bob", email: "bob@example.com", contact_type: "other" },
    { name: "Alice2", email: "alice@example.com", contact_type: "other" }, // duplicate email
    { name: "No Email", contact_type: "other" },
  ];

  it("flags contacts that already exist in the DB", () => {
    const existing = new Set(["alice@example.com"]);
    const result = findDuplicates(contacts, existing);
    const alice = result.find((c) => c.name === "Alice");
    expect(alice?.duplicateMatch).toBeTruthy();
  });

  it("flags in-import duplicates", () => {
    const result = findDuplicates(contacts, new Set());
    const alice2 = result.find((c) => c.name === "Alice2");
    expect(alice2?.duplicateMatch).toBeTruthy();
  });

  it("passes through contacts with no email", () => {
    const result = findDuplicates(contacts, new Set());
    const noEmail = result.find((c) => c.name === "No Email");
    expect(noEmail).toBeDefined();
    expect(noEmail?.duplicateMatch).toBeUndefined();
  });

  it("returns same count as input", () => {
    const result = findDuplicates(contacts, new Set());
    expect(result).toHaveLength(contacts.length);
  });
});
