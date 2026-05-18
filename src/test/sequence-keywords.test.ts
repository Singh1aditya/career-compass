import { describe, it, expect } from "vitest";
import { extractRoleTokens, roleMatches, matchedTokens } from "@/lib/sequence-keywords";

describe("extractRoleTokens", () => {
  it("returns empty array for null/undefined", () => {
    expect(extractRoleTokens(null)).toEqual([]);
    expect(extractRoleTokens(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractRoleTokens("")).toEqual([]);
  });

  it("lowercases tokens", () => {
    expect(extractRoleTokens("Engineer")).toContain("engineer");
  });

  it("splits on hyphens", () => {
    // "full" is a stopword, so only "stack" survives
    const tokens = extractRoleTokens("full-stack");
    expect(tokens).toContain("stack");
    expect(tokens).not.toContain("full");
  });

  it("splits on slashes", () => {
    const tokens = extractRoleTokens("iOS/Android");
    expect(tokens).toContain("ios");
    expect(tokens).toContain("android");
  });

  it("filters stopwords (senior, junior, lead, etc.)", () => {
    const tokens = extractRoleTokens("Senior Software Engineer");
    expect(tokens).not.toContain("senior");
    expect(tokens).toContain("software");
    expect(tokens).toContain("engineer");
  });

  it("filters very short tokens (< 3 chars)", () => {
    const tokens = extractRoleTokens("VP of Engineering");
    expect(tokens).not.toContain("of");
    expect(tokens).not.toContain("vp");
  });

  it("deduplicates repeated tokens", () => {
    const tokens = extractRoleTokens("engineer engineer");
    expect(tokens.filter((t) => t === "engineer")).toHaveLength(1);
  });

  it("handles a realistic job title", () => {
    const tokens = extractRoleTokens("Staff Product Manager, Growth");
    expect(tokens).toContain("product");
    expect(tokens).toContain("manager");
    expect(tokens).toContain("growth");
    expect(tokens).not.toContain("staff");
  });
});

describe("roleMatches", () => {
  it("returns true when there is a meaningful shared token", () => {
    expect(roleMatches("Software Engineer", "Senior Software Developer")).toBe(true);
  });

  it("returns true on exact single-token overlap", () => {
    expect(roleMatches("Product Manager", "Product Director")).toBe(true);
  });

  it("returns false when there is no meaningful overlap", () => {
    expect(roleMatches("Software Engineer", "Sales Representative")).toBe(false);
  });

  it("returns false when contactRole is null", () => {
    expect(roleMatches("Software Engineer", null)).toBe(false);
  });

  it("returns false when contactRole is empty", () => {
    expect(roleMatches("Software Engineer", "")).toBe(false);
  });

  it("returns false when applicationTitle yields no tokens (all stopwords)", () => {
    expect(roleMatches("Senior Lead Junior", "Senior Lead Junior")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(roleMatches("software engineer", "SOFTWARE ENGINEER")).toBe(true);
  });
});

describe("matchedTokens", () => {
  it("returns the overlapping tokens", () => {
    const tokens = matchedTokens("Product Manager", "Senior Product Designer");
    expect(tokens).toContain("product");
    expect(tokens).not.toContain("designer");
    expect(tokens).not.toContain("manager");
  });

  it("returns empty array when contactRole is null", () => {
    expect(matchedTokens("Software Engineer", null)).toEqual([]);
  });

  it("returns empty array when there is no overlap", () => {
    expect(matchedTokens("Software Engineer", "Sales Representative")).toEqual([]);
  });

  it("returns multiple matching tokens", () => {
    const tokens = matchedTokens("Software Engineering Manager", "Engineering Software Architect");
    expect(tokens).toContain("software");
    expect(tokens).toContain("engineering");
  });
});
