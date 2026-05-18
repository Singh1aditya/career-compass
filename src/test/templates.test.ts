import { describe, it, expect, beforeEach } from "vitest";
import { renderTemplate, clearSenderCache } from "@/lib/templates";

beforeEach(() => {
  clearSenderCache();
});

const contact = {
  name: "Alice Smith",
  email: "alice@example.com",
  company_name: "Acme Corp",
  role: "Product Manager",
};

describe("renderTemplate — contact variables", () => {
  it("replaces {{first_name}}", () => {
    expect(renderTemplate("Hi {{first_name}}", contact)).toBe("Hi Alice");
  });

  it("replaces {{full_name}}", () => {
    expect(renderTemplate("Dear {{full_name}}", contact)).toBe("Dear Alice Smith");
  });

  it("replaces {{company}}", () => {
    expect(renderTemplate("at {{company}}", contact)).toBe("at Acme Corp");
  });

  it("replaces {{role}}", () => {
    expect(renderTemplate("role: {{role}}", contact)).toBe("role: Product Manager");
  });

  it("replaces {{contact_email}}", () => {
    expect(renderTemplate("email: {{contact_email}}", contact)).toBe("email: alice@example.com");
  });

  it("replaces multiple variables in one pass", () => {
    const out = renderTemplate("{{first_name}} at {{company}}", contact);
    expect(out).toBe("Alice at Acme Corp");
  });

  it("is case-insensitive for variable names", () => {
    expect(renderTemplate("{{FIRST_NAME}}", contact)).toBe("Alice");
    expect(renderTemplate("{{FULL_NAME}}", contact)).toBe("Alice Smith");
  });

  it("trims whitespace inside braces", () => {
    expect(renderTemplate("{{ first_name }}", contact)).toBe("Alice");
  });
});

describe("renderTemplate — fallbacks when contact fields are empty", () => {
  const sparse = { name: "", email: null, company_name: null, role: null };

  it("falls back to [First Name] when name is empty", () => {
    expect(renderTemplate("{{first_name}}", sparse)).toBe("[First Name]");
  });

  it("falls back to [Name] when full_name is empty", () => {
    expect(renderTemplate("{{full_name}}", sparse)).toBe("[Name]");
  });

  it("falls back to [Company] when company is null", () => {
    expect(renderTemplate("{{company}}", sparse)).toBe("[Company]");
  });

  it("falls back to [Role] when role is null", () => {
    expect(renderTemplate("{{role}}", sparse)).toBe("[Role]");
  });

  it("falls back to [Email] when email is null", () => {
    expect(renderTemplate("{{contact_email}}", sparse)).toBe("[Email]");
  });
});

describe("renderTemplate — sender variables", () => {
  const sender = { display_name: "Bob", signature: "Cheers,\nBob", role: "Recruiter" };

  it("replaces {{my_name}}", () => {
    expect(renderTemplate("From {{my_name}}", contact, sender)).toBe("From Bob");
  });

  it("replaces {{my_role}}", () => {
    expect(renderTemplate("{{my_role}}", contact, sender)).toBe("Recruiter");
  });

  it("replaces {{my_signature}}", () => {
    expect(renderTemplate("{{my_signature}}", contact, sender)).toContain("Cheers");
  });

  it("defaults my_name to 'You' when sender is omitted", () => {
    expect(renderTemplate("{{my_name}}", contact)).toBe("You");
  });

  it("defaults my_signature to empty string when sender is omitted", () => {
    expect(renderTemplate("{{my_signature}}", contact)).toBe("");
  });
});

describe("renderTemplate — edge cases", () => {
  it("returns unchanged text when there are no variables", () => {
    const text = "Hello there, no substitutions here.";
    expect(renderTemplate(text, contact)).toBe(text);
  });

  it("handles empty template string", () => {
    expect(renderTemplate("", contact)).toBe("");
  });

  it("handles unknown variables (leaves them untouched)", () => {
    const text = "{{unknown_var}}";
    expect(renderTemplate(text, contact)).toBe(text);
  });

  it("replaces repeated occurrences of the same variable", () => {
    const out = renderTemplate("{{first_name}} and {{first_name}}", contact);
    expect(out).toBe("Alice and Alice");
  });

  it("extracts first name from multi-word name", () => {
    const c = { ...contact, name: "Mary Jane Watson" };
    expect(renderTemplate("{{first_name}}", c)).toBe("Mary");
  });
});
