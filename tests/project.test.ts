import { describe, it, expect } from "vitest";
import { parseProject, serializeProject, PROJECT_VERSION, PROJECT_EXT } from "@/lib/project";
import { DEFAULT_CAPTION_SETTINGS, presetFor } from "@/lib/captions/presets";
import { DEFAULT_REFRAME } from "@/lib/reframe/state";
import type { CaptionLine, Moment } from "@/lib/types";

const clips: Moment[] = [
  { id: "c1", start: 2.5, end: 32.5, score: 87, label: "Highlight 1" },
  { id: "c2", start: 60, end: 90, score: 74, label: "Highlight 2" },
];

const captions: CaptionLine[] = [
  {
    id: "l1",
    start: 3,
    end: 6,
    text: "This is the moment",
    words: [
      { text: "This", start: 3, end: 3.6 },
      { text: "is", start: 3.6, end: 4.1 },
    ],
  },
];

describe("project serialization", () => {
  it("round-trips a full project state", () => {
    const state = {
      media: { name: "talk.mp4", duration: 120.4 },
      clips,
      captions,
      captionStyle: "pop" as const,
      captionSettings: presetFor("pop"),
      aspect: "9:16" as const,
      reframe: { ...DEFAULT_REFRAME, enabled: true, offsetY: 0.2, scale: 1.4 },
      clipLength: 30 as const,
      highlightsSource: "ai" as const,
      name: "My talk",
    };
    const json = JSON.stringify(serializeProject(state));
    const result = parseProject(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p = result.project;
    expect(p.app).toBe("ittyclip");
    expect(p.version).toBe(PROJECT_VERSION);
    expect(p.project.name).toBe("My talk");
    expect(p.media?.name).toBe("talk.mp4");
    expect(p.clips).toHaveLength(2);
    expect(p.clips[0].start).toBe(2.5);
    expect(p.clips[0].score).toBe(87);
    expect(p.captions[0].words).toHaveLength(2);
    expect(p.aspect).toBe("9:16");
    expect(p.settings.clipLength).toBe(30);
    expect(p.metadata.highlightsSource).toBe("ai");
    expect(p.reframe.enabled).toBe(true);
    expect(p.reframe.scale).toBe(1.4);
    expect(p.captionSettings.font).toBe(presetFor("pop").font);
  });

  it("sanitizes out-of-range values on parse", () => {
    const bad = {
      app: "ittyclip",
      version: 2,
      project: { name: "x", createdAt: new Date().toISOString() },
      media: null,
      clips: [
        { id: "c", start: -5, end: 10, score: 500, label: "x" },
        { id: "c2", start: 20, end: 10, score: 50, label: "x" },
        { id: "c3", start: 0, end: 5, score: "nope", label: "x" },
      ],
      captions: [],
      captionStyle: "not-a-style",
      captionSettings: { size: 99, textColor: "red" },
      aspect: "3:2",
      reframe: { enabled: true, scale: 9 },
      settings: { clipLength: 999 },
      metadata: {},
    };
    const result = parseProject(JSON.stringify(bad));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.project;
    expect(p.clips).toHaveLength(2);
    expect(p.clips[0].start).toBe(0);
    expect(p.clips[0].score).toBe(100);
    expect(p.clips[1].score).toBe(50);
    expect(p.captionStyle).toBe("pop");
    expect(p.aspect).toBe("9:16");
    expect(p.settings.clipLength).toBe(30);
    expect(p.reframe.scale).toBe(2);
    expect(p.captionSettings.size).toBe(2);
    expect(p.captionSettings.textColor).toBe(DEFAULT_CAPTION_SETTINGS.textColor);
  });

  it("supports v1 projects via migration", () => {
    const v1 = {
      app: "ittyclip",
      version: 1,
      clips: [
        { id: "c", start: 1, end: 6, score: 66, label: "old" },
      ],
      captions: [],
      captionStyle: "classic",
      aspect: "16:9",
    };
    const result = parseProject(JSON.stringify(v1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.version).toBe(PROJECT_VERSION);
    expect(result.project.clips[0].label).toBe("old");
    expect(result.project.captionSettings).toEqual(DEFAULT_CAPTION_SETTINGS);
  });
});

describe("project validation failures", () => {
  it("rejects invalid JSON with a friendly reason", () => {
    const result = parseProject("{not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not valid JSON");
  });

  it("rejects files from other apps", () => {
    const result = parseProject(JSON.stringify({ app: "capcut", version: 2 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not created by ittyclip");
  });

  it("rejects unsupported versions", () => {
    const result = parseProject(JSON.stringify({ app: "ittyclip", version: 99 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("Unsupported project version");
  });

  it("has the expected extension", () => {
    expect(PROJECT_EXT).toBe(".ittyclip");
  });
});
