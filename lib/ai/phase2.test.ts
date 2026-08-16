import { describe, expect, it } from "vitest";
import { sanitizeContext } from "@/lib/ai/phase2";

describe("Phase 2 AI context", () => {
  it("clamps transcript timestamps to the video duration", () => {
    const ctx = sanitizeContext({ duration: 60, transcript: [
      { start: -5, end: 10, text: "hello" },
      { start: 50, end: 80, text: "world" },
    ] });
    expect(ctx.transcript).toEqual([
      { start: 0, end: 10, text: "hello" },
      { start: 50, end: 60, text: "world" },
    ]);
  });

  it("rejects invalid duration", () => {
    expect(() => sanitizeContext({ duration: 0, transcript: [] })).toThrow();
  });

  it("keeps a selected clip inside the source duration", () => {
    const ctx = sanitizeContext({ duration: 100, transcript: [], selectedClip: { start: -10, end: 120 } });
    expect(ctx.selectedClip).toEqual({ start: 0, end: 100 });
  });
});
