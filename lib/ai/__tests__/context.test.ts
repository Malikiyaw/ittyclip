import { describe, expect, it } from "vitest";
import { buildAiContext } from "@/lib/ai/context";

describe("AI context", () => {
  it("clamps and sorts transcript timestamps", () => {
    const context = buildAiContext({
      duration: 60,
      transcript: [
        { start: 50, end: 70, text: "late" },
        { start: -4, end: 5, text: "early" },
        { start: 10, end: 9, text: "invalid" },
      ],
    });
    expect(context.transcript).toEqual([
      { start: 0, end: 5, text: "early" },
      { start: 50, end: 60, text: "late" },
    ]);
  });

  it("sanitizes signal ranges", () => {
    const context = buildAiContext({
      duration: 30,
      silence: [{ start: -2, end: 4 }, { start: 50, end: 70 }],
      energy: [{ time: 5, value: 2 }, { time: 10, value: -1 }],
    });
    expect(context.silence).toEqual([{ start: 0, end: 4 }]);
    expect(context.energy).toEqual([{ time: 5, value: 1 }, { time: 10, value: 0 }]);
  });
});
