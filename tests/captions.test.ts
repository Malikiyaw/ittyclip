import { describe, it, expect } from "vitest";
import {
  segmentTranscript,
  makeLines,
  buildSrt,
  srtTimestamp,
  escapeDrawtext,
  breakCaptionLines,
} from "@/lib/captions";
import { CAPTION_PRESETS, DEFAULT_CAPTION_SETTINGS, presetFor, animationClass } from "@/lib/captions/presets";
import { SAFE_ZONES } from "@/lib/captions/safezones";

describe("caption timing", () => {
  it("distributes words across silence segments", () => {
    const lines = segmentTranscript("one two three four five six seven eight", [
      { start: 0, end: 4 },
      { start: 4, end: 8 },
    ]);
    expect(lines.length).toBe(2);
    expect(lines[0].words.length).toBeGreaterThan(0);
    expect(lines[0].start).toBe(0);
    expect(lines[1].start).toBe(4);
    for (const line of lines) {
      expect(line.end).toBeLessThanOrEqual(line.start + 5);
      expect(line.words[0].start).toBeCloseTo(line.start, 3);
      expect(line.text.split(" ").length).toBe(line.words.length);
    }
  });

  it("returns no lines for empty input", () => {
    expect(segmentTranscript("", [{ start: 0, end: 4 }])).toEqual([]);
    expect(segmentTranscript("hello", [])).toEqual([]);
  });

  it("builds SRT with padded timestamps", () => {
    const srt = buildSrt([
      { id: "l", start: 1, end: 2.5, text: "Hello", words: [] },
    ]);
    expect(srt).toContain("00:00:01,000 --> 00:00:02,500");
    expect(srt).toContain("Hello");
    expect(srtTimestamp(3661.25)).toBe("01:01:01,250");
  });

  it("escapes ffmpeg drawtext special characters", () => {
    expect(escapeDrawtext("it's 100% {fun}, right?")).toContain("it\\'s");
    expect(escapeDrawtext("a:b")).toContain("a\\:b");
    expect(escapeDrawtext("100%")).toContain("100\\%");
    expect(escapeDrawtext("x\ny")).not.toContain("\n");
  });
});

describe("caption breaking", () => {
  it("splits into at most two balanced lines, keeping word order", () => {
    const text =
      "This is a very long sentence that absolutely needs to be split across several lines for readability";
    const lines = breakCaptionLines(text);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.join(" ").split(" ").length).toBe(text.split(" ").length);
    expect(lines.join(" ")).toBe(text);
  });

  it("keeps a short phrase on a single line", () => {
    expect(breakCaptionLines("Short caption")).toEqual(["Short caption"]);
  });

  it("respects a tighter char budget", () => {
    const lines = breakCaptionLines("one two three four five six seven eight", 14);
    expect(lines.length).toBe(2);
  });
});

describe("presets", () => {
  it("defines all six styles with full settings", () => {
    const keys = Object.keys(CAPTION_PRESETS);
    expect(keys.sort()).toEqual(["bold", "classic", "karaoke", "minimal", "neon", "pop"].sort());
    for (const key of keys) {
      const p = presetFor(key as keyof typeof CAPTION_PRESETS);
      expect(p.font).toBeDefined();
      expect(p.size).toBeGreaterThan(0);
      expect(p.textColor).toMatch(/^#/);
      expect(p.highlightColor).toMatch(/^#/);
      expect(["bottom", "middle", "top"]).toContain(p.position);
    }
  });

  it("has a sane default and valid animation classes", () => {
    expect(DEFAULT_CAPTION_SETTINGS.font).toBe("display");
    expect(animationClass("word-pop")).toBe("s-caption-anim-word");
    expect(animationClass("pop")).toBe("s-caption-anim-pop");
    expect(animationClass("none")).toBe("");
  });
});

describe("safe zones", () => {
  it("contains the three vertical platforms", () => {
    const keys = SAFE_ZONES.map((z) => z.key).sort();
    expect(keys).toEqual(["reels", "shorts", "tiktok"]);
    for (const zone of SAFE_ZONES) {
      expect(zone.bottom).toBeGreaterThan(0);
      expect(zone.bottom).toBeLessThan(1);
      expect(zone.right).toBeGreaterThan(0);
      expect(zone.right).toBeLessThan(1);
      expect(zone.top).toBeGreaterThan(0);
    }
  });
});
