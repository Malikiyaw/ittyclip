import { describe, expect, it } from "vitest";
import { generateCandidates, nearestSilenceEdge, snapToWord } from "@/lib/analysis/candidates";
import type { CaptionLine } from "@/lib/types";

const transcript: CaptionLine[] = [
  { id: "1", start: 0, end: 5, text: "This is the first sentence.", words: [
    { text: "This", start: 0, end: 1 }, { text: "is", start: 1, end: 2 }, { text: "the", start: 2, end: 3 }, { text: "first", start: 3, end: 4 }, { text: "sentence.", start: 4, end: 5 },
  ] },
  { id: "2", start: 5, end: 10, text: "Here is the important answer.", words: [
    { text: "Here", start: 5, end: 6 }, { text: "is", start: 6, end: 7 }, { text: "the", start: 7, end: 8 }, { text: "important", start: 8, end: 9 }, { text: "answer.", start: 9, end: 10 },
  ] },
];

describe("highlight candidate boundaries", () => {
  it("snaps to nearby word boundaries", () => {
    expect(snapToWord(4.08, transcript)).toBe(4);
    expect(snapToWord(20, transcript)).toBeNull();
  });

  it("snaps only to silence edges inside the configured radius", () => {
    expect(nearestSilenceEdge(5.3, [{ start: 5, end: 5.2 }])).toBe(5.2);
    expect(nearestSilenceEdge(8, [{ start: 5, end: 5.2 }])).toBe(8);
  });

  it("keeps generated candidates inside duration and requested length bounds", () => {
    const candidates = generateCandidates(30, 10, [{ start: 9.7, end: 10.2 }], transcript, { step: 2, slack: 0.12, minLen: 3 });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.start).toBeGreaterThanOrEqual(0);
      expect(c.end).toBeLessThanOrEqual(30);
      expect(c.end - c.start).toBeGreaterThanOrEqual(9.5);
      expect(c.end - c.start).toBeLessThanOrEqual(10 * 1.12 + 0.01);
    }
  });
});
