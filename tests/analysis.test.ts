import { describe, it, expect } from "vitest";
import { temporalOverlap, temporalUnion, temporalIoU, nonMaxSuppression } from "@/lib/analysis/overlap";
import { runHighlightAnalysis } from "@/lib/analysis/engine";
import { pickReason } from "@/lib/analysis/reasons";
import { DEFAULT_WEIGHTS, normalizeWeights, reasonSpec } from "@/lib/analysis/config";
import type { CaptionLine } from "@/lib/types";

/** 100 s envelope at hopSec 0.05: speech 10–40 s and 60–90 s, else near-silence. */
function speechEnvelope(hop = 0.05): Float32Array {
  const n = Math.round(100 / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * hop;
    const inSpeech = (t >= 10 && t < 40) || (t >= 60 && t < 90);
    env[i] = inSpeech ? 0.5 + (i % 7) * 0.04 : 0.004;
  }
  return env;
}

describe("temporal overlap utilities", () => {
  it("computes overlap, union and IoU", () => {
    const a = { start: 5, end: 15 };
    const b = { start: 12, end: 20 };
    expect(temporalOverlap(a, b)).toBe(3);
    expect(temporalUnion(a, b)).toBe(15);
    expect(temporalIoU(a, b)).toBeCloseTo(3 / 15, 5);
  });

  it("returns 0 overlap for disjoint segments", () => {
    expect(temporalOverlap({ start: 0, end: 5 }, { start: 5, end: 9 })).toBe(0);
    expect(temporalIoU({ start: 0, end: 5 }, { start: 6, end: 9 })).toBe(0);
  });

  it("suppresses overlapping items, keeping earlier (higher priority) ones", () => {
    const items = [
      { start: 0, end: 10, score: 90 },
      { start: 2, end: 9, score: 80 },
      { start: 20, end: 30, score: 70 },
    ];
    const kept = nonMaxSuppression(items, 0.5);
    expect(kept).toHaveLength(2);
    expect(kept[0].score).toBe(90);
    expect(kept[1].score).toBe(70);
  });
});

describe("local highlight engine", () => {
  it("finds highlights inside speech regions, sorted and de-duplicated", () => {
    const silence = [
      { start: 0, end: 10 },
      { start: 40, end: 60 },
      { start: 90, end: 100 },
    ];
    const highlights = runHighlightAnalysis({
      envelope: speechEnvelope(),
      hopSec: 0.05,
      duration: 100,
      silence,
      transcript: null,
      clipLength: 15,
      maxResults: 10,
    });

    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights.length).toBeLessThanOrEqual(10);

    for (let i = 1; i < highlights.length; i++) {
      expect(highlights[i - 1].score).toBeGreaterThanOrEqual(highlights[i].score);
    }

    const speechRanges = [
      { start: 10, end: 40 },
      { start: 60, end: 90 },
    ];
    for (const h of highlights) {
      expect(h.end - h.start).toBeGreaterThanOrEqual(3);
      expect(h.end - h.start).toBeLessThanOrEqual(15 * 1.12 + 1);
      // Every window must actually contain speech…
      const overlaps = speechRanges.some(
        (r) => Math.min(h.end, r.end) - Math.max(h.start, r.start) > 0
      );
      expect(overlaps).toBe(true);
      expect(h.source).toBe("local");
    }
    // …and the top picks (what users actually get) sit cleanly inside
    // the speech regions, not on mixed silence edges.
    for (const h of highlights.slice(0, 2)) {
      const clean = speechRanges.some((r) => h.start >= r.start - 0.5 && h.end <= r.end + 0.5);
      expect(clean).toBe(true);
    }

    // No two windows may overlap past the IoU threshold.
    for (let i = 0; i < highlights.length; i++) {
      for (let j = i + 1; j < highlights.length; j++) {
        expect(temporalIoU(highlights[i], highlights[j])).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("re-ranks instantly for a different clip length", () => {
    const a = runHighlightAnalysis({
      envelope: speechEnvelope(),
      hopSec: 0.05,
      duration: 100,
      silence: [],
      transcript: null,
      clipLength: 15,
      maxResults: 10,
    });
    const b = runHighlightAnalysis({
      envelope: speechEnvelope(),
      hopSec: 0.05,
      duration: 100,
      silence: [],
      transcript: null,
      clipLength: 60,
      maxResults: 10,
    });
    expect(b.length).toBeGreaterThan(0);
    for (const h of b) {
      expect(h.end - h.start).toBeGreaterThanOrEqual(3);
      expect(h.end - h.start).toBeLessThanOrEqual(60 * 1.12 + 1);
    }
    expect(a).not.toEqual(b);
  });
});

describe("reason picking", () => {
  const transcript: CaptionLine[] = [
    {
      id: "l1",
      start: 0,
      end: 2,
      text: "Wait, did you actually see what happened last night?",
      words: [],
    },
  ];

  it("detects questions from the transcript", () => {
    const reason = pickReason({
      breakdown: {
        speech: 70,
        energy: 55,
        pacing: 60,
        silence: 40,
        quotability: 65,
        completeness: 50,
        boundary: 45,
        total: 60,
      },
      transcript,
      start: 0,
      end: 2,
    });
    expect(["question", "quote", "surprise", "insight"]).toContain(reason.key);
  });

  it("falls back to a generic reason for weak signals", () => {
    const reason = pickReason({
      breakdown: {
        speech: 10,
        energy: 10,
        pacing: 10,
        silence: 10,
        quotability: 0,
        completeness: 10,
        boundary: 10,
        total: 10,
      },
      transcript: null,
      start: 0,
      end: 2,
    });
    expect(reason.key).toBe("general");
  });
});

describe("weights", () => {
  it("sums to 1 and re-normalizes when quotability is dropped", () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 5);

    const keys = Object.keys(DEFAULT_WEIGHTS) as (keyof typeof DEFAULT_WEIGHTS)[];
    const without = keys.filter((k) => k !== "quotability");
    const normalized = normalizeWeights(DEFAULT_WEIGHTS, without);
    const sum = without.reduce((s, k) => s + normalized[k], 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(normalized.quotability).toBe(0);
  });

  it("resolves every reason key to a spec", () => {
    for (const key of ["energy", "question", "statement", "quote", "surprise", "insight", "pacing", "hook", "story", "general"]) {
      expect(reasonSpec(key as never).key).toBe(key);
    }
    expect(reasonSpec("does-not-exist" as never).key).toBe("general");
  });
});
