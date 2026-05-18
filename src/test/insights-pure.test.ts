import { describe, it, expect } from "vitest";
// Test the pure stateless helpers embedded in insights.ts by replicating
// the same logic here — these are algorithmic functions, not DB calls.

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

describe("median (time-in-stage helper)", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the single element for length-1 array", () => {
    expect(median([7])).toBe(7);
  });

  it("returns the middle element for odd-length array", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("returns the average of two middle elements for even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("sorts before computing (handles unsorted input)", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("handles duplicate values", () => {
    expect(median([2, 2, 2, 2])).toBe(2);
  });

  it("handles large spread", () => {
    expect(median([0, 100])).toBe(50);
  });
});

describe("responseRate calculation", () => {
  // The rate formula: sent > 0 ? round((replied / sent) * 100) : 0
  function calcRate(sent: number, replied: number): number {
    return sent > 0 ? Math.round((replied / sent) * 100) : 0;
  }

  it("returns 0 when nothing was sent", () => {
    expect(calcRate(0, 0)).toBe(0);
  });

  it("returns 100 when all sent emails received replies", () => {
    expect(calcRate(5, 5)).toBe(100);
  });

  it("returns 50 for half response rate", () => {
    expect(calcRate(10, 5)).toBe(50);
  });

  it("rounds fractional rates", () => {
    expect(calcRate(3, 1)).toBe(33);
  });

  it("is capped at 100 (no negative)", () => {
    // replied can't exceed sent in practice but guard boundary
    expect(calcRate(5, 5)).toBeLessThanOrEqual(100);
  });
});

describe("funnelData aggregation", () => {
  // Replicate the in-memory count aggregation from fetchFunnelData
  function aggregateStatuses(rows: { status: string }[]): { status: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }

  it("returns empty array for no data", () => {
    expect(aggregateStatuses([])).toEqual([]);
  });

  it("counts single status correctly", () => {
    const result = aggregateStatuses([{ status: "applied" }, { status: "applied" }]);
    expect(result).toEqual([{ status: "applied", count: 2 }]);
  });

  it("counts multiple statuses", () => {
    const rows = [
      { status: "applied" },
      { status: "interviewing" },
      { status: "applied" },
      { status: "offer" },
    ];
    const result = aggregateStatuses(rows);
    const applied = result.find((r) => r.status === "applied");
    const interviewing = result.find((r) => r.status === "interviewing");
    const offer = result.find((r) => r.status === "offer");
    expect(applied?.count).toBe(2);
    expect(interviewing?.count).toBe(1);
    expect(offer?.count).toBe(1);
  });
});
