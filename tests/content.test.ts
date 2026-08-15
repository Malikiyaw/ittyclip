import { describe, it, expect } from "vitest";
import { contentIntelligence, extractHashtags, classifyCategory } from "@/lib/content";
import type { CaptionLine } from "@/lib/types";

const line = (text: string, start = 0, end = 2): CaptionLine => ({
  id: "x",
  start,
  end,
  text,
  words: [],
});

describe("contentIntelligence", () => {
  it("builds title, hook, description and hashtags from the transcript", () => {
    const transcript = [
      line("In this video I'm going to show you how to edit a short with this tool", 0, 4),
      line("First you pick the clip, then you add captions, then you hit export", 4, 8),
    ];
    const ci = contentIntelligence(transcript);
    expect(ci.title.length).toBeGreaterThan(0);
    expect(ci.hook.length).toBeGreaterThan(0);
    expect(ci.description).toContain("how to edit");
    expect(ci.hashtags.length).toBeGreaterThanOrEqual(2);
    expect(ci.category.length).toBeGreaterThan(0);
  });

  it("falls back to defaults for an empty transcript", () => {
    const ci = contentIntelligence([]);
    expect(ci.title).toBeTruthy();
    expect(ci.hook).toBeTruthy();
    expect(ci.hashtags.length).toBeGreaterThanOrEqual(2);
  });
});

describe("extractHashtags", () => {
  it("picks frequent non-stopword nouns", () => {
    const transcript = Array.from({ length: 6 }, (_, i) =>
      line(`the camera settings aperture shutter exposure iso ${i}`, i, i + 1)
    );
    const tags = extractHashtags(transcript);
    expect(tags).toContain("camera");
    expect(tags).toContain("settings");
    expect(tags.every((t) => /^[a-z0-9]+$/.test(t))).toBe(true);
  });
});

describe("classifyCategory", () => {
  it("detects gaming content from keywords", () => {
    expect(classifyCategory([line("so the match starts and the score is close")])).toBe("Gaming");
  });

  it("detects tutorials", () => {
    expect(classifyCategory([line("let me show you how to set up the click button")])).toBe("Tutorial & how-to");
  });

  it("returns General when nothing matches", () => {
    expect(classifyCategory([line("the blue ocean is calm and the fish are swimming near the rocks")])).toBe("General");
  });
});