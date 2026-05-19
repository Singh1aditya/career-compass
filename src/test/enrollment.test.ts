import { describe, it, expect, vi, beforeEach } from "vitest";

// We test enrollContactInSequence's pure data-shaping logic by mocking
// the Supabase call and verifying the returned insert payload.

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { delay_days: 2, step_type: "initial" },
              error: null,
            }),
          }),
        }),
      }),
    }),
  },
}));

import { enrollContactInSequence } from "@/lib/sequence-utils";

describe("enrollContactInSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a payload with correct sequence_id and contact_id", async () => {
    const payload = await enrollContactInSequence("user-1", "seq-1", "contact-1");
    expect(payload.sequence_id).toBe("seq-1");
    expect(payload.contact_id).toBe("contact-1");
  });

  it("sets initial state to 'waiting'", async () => {
    const payload = await enrollContactInSequence("user-1", "seq-1", "contact-1");
    expect(payload.state).toBe("waiting");
  });

  it("calculates next_send_at based on delay_days (2 days ahead)", async () => {
    const before = Date.now();
    const payload = await enrollContactInSequence("user-1", "seq-1", "contact-1");
    const after = Date.now();

    const nextSendAt = new Date(payload.next_send_at as string).getTime();
    const expectedMin = before + 2 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 2 * 24 * 60 * 60 * 1000;

    expect(nextSendAt).toBeGreaterThanOrEqual(expectedMin);
    expect(nextSendAt).toBeLessThanOrEqual(expectedMax);
  });
});
