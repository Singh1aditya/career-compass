import { describe, it, expect } from "vitest";
import {
  APPLICATION_STATUSES,
  PIPELINE_STATUSES,
  statusColors,
  statusLabel,
} from "@/lib/status";

describe("APPLICATION_STATUSES", () => {
  it("contains all expected statuses", () => {
    expect(APPLICATION_STATUSES).toContain("wishlist");
    expect(APPLICATION_STATUSES).toContain("applied");
    expect(APPLICATION_STATUSES).toContain("screening");
    expect(APPLICATION_STATUSES).toContain("interviewing");
    expect(APPLICATION_STATUSES).toContain("offer");
    expect(APPLICATION_STATUSES).toContain("rejected");
    expect(APPLICATION_STATUSES).toContain("withdrawn");
  });

  it("has 7 statuses", () => {
    expect(APPLICATION_STATUSES).toHaveLength(7);
  });
});

describe("PIPELINE_STATUSES", () => {
  it("excludes rejected and withdrawn", () => {
    expect(PIPELINE_STATUSES).not.toContain("rejected");
    expect(PIPELINE_STATUSES).not.toContain("withdrawn");
  });

  it("is a subset of APPLICATION_STATUSES", () => {
    for (const s of PIPELINE_STATUSES) {
      expect(APPLICATION_STATUSES).toContain(s);
    }
  });
});

describe("statusColors", () => {
  it("has a color for every application status", () => {
    for (const s of APPLICATION_STATUSES) {
      expect(statusColors[s]).toBeDefined();
      expect(typeof statusColors[s]).toBe("string");
    }
  });
});

describe("statusLabel", () => {
  it("has a label for every application status", () => {
    for (const s of APPLICATION_STATUSES) {
      expect(statusLabel[s]).toBeDefined();
      expect(statusLabel[s].length).toBeGreaterThan(0);
    }
  });

  it("capitalises the first letter", () => {
    for (const label of Object.values(statusLabel)) {
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });
});
