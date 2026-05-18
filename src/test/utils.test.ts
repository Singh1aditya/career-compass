import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (class name merger)", () => {
  it("returns a single class unchanged", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("joins multiple classes with a space", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("merges conflicting tailwind classes (last one wins)", () => {
    // tailwind-merge resolves conflicting utilities
    const result = cn("text-sm", "text-lg");
    expect(result).toBe("text-lg");
  });

  it("merges conflicting padding classes", () => {
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
  });

  it("handles conditional classes via objects", () => {
    expect(cn({ hidden: true, flex: false })).toBe("hidden");
    expect(cn({ hidden: false, flex: true })).toBe("flex");
  });

  it("handles conditional classes via arrays", () => {
    const isActive = true;
    const result = cn("base", isActive && "active");
    expect(result).toBe("base active");
  });

  it("filters out falsy values", () => {
    expect(cn("base", false, null, undefined, "end")).toBe("base end");
  });

  it("returns empty string when all inputs are falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });

  it("handles empty string inputs gracefully", () => {
    expect(cn("", "flex")).toBe("flex");
  });

  it("de-duplicates identical classes via tailwind-merge", () => {
    const result = cn("flex flex", "flex");
    // tailwind-merge normalises duplicates
    expect(result).toBe("flex");
  });
});
