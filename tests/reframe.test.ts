import { describe, it, expect } from "vitest";
import { reframeCropAt, pointAt } from "@/lib/reframe/math";
import { smoothTrack, fillGaps, normalizeTrack } from "@/lib/reframe/smooth";
import { buildCropExpression } from "@/lib/reframe/trajectory";
import { DEFAULT_REFRAME, type ReframeState, type TrackPoint } from "@/lib/reframe/state";

describe("reframeCropAt", () => {
  it("keeps the crop inside the source frame", () => {
    const reframe: ReframeState = {
      ...DEFAULT_REFRAME,
      enabled: true,
      mode: "tracked",
      scale: 1.8,
      track: [
        { t: 0, x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
        { t: 10, x: 0.9, y: 0.9, w: 0.3, h: 0.3 },
      ],
    };
    for (const t of [0, 5, 10]) {
      const c = reframeCropAt(t, 1920, 1080, 9 / 16, reframe);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(1920 + 0.001);
      expect(c.y + c.h).toBeLessThanOrEqual(1080 + 0.001);
      expect(c.w).toBeLessThanOrEqual(1920);
      expect(c.h).toBeLessThanOrEqual(1080);
      expect(c.w / c.h).toBeCloseTo(9 / 16, 3);
    }
  });

  it("centers the crop when no track exists", () => {
    const reframe: ReframeState = { ...DEFAULT_REFRAME, enabled: true, mode: "center", scale: 1.5 };
    const c = reframeCropAt(0, 1920, 1080, 9 / 16, reframe);
    expect(c.w / c.h).toBeCloseTo(9 / 16, 3);
    // Center-crop with scale 1.5: horizontal center for 9:16 from 16:9 source.
    expect(Math.abs(c.x + c.w / 2 - 960)).toBeLessThan(2);
    expect(Math.abs(c.y + c.h / 2 - 540)).toBeLessThan(2);
  });

  it("interpolates the track between keyframes", () => {
    const reframe: ReframeState = {
      ...DEFAULT_REFRAME,
      enabled: true,
      mode: "tracked",
      scale: 1.2,
      track: [
        { t: 0, x: 0.2, y: 0.3, w: 0.3, h: 0.3 },
        { t: 10, x: 0.6, y: 0.7, w: 0.3, h: 0.3 },
      ],
    };
    const a = reframeCropAt(0, 1920, 1080, 9 / 16, reframe);
    const b = reframeCropAt(10, 1920, 1080, 9 / 16, reframe);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe("pointAt", () => {
  it("clamps outside the track range", () => {
    const track: TrackPoint[] = [
      { t: 2, x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
      { t: 8, x: 0.6, y: 0.6, w: 0.3, h: 0.3 },
    ];
    expect(pointAt(0, track)!.t).toBe(2);
    expect(pointAt(99, track)!.t).toBe(8);
  });
});

describe("track smoothing", () => {
  it("smooths and keeps time order", () => {
    const raw: TrackPoint[] = [
      { t: 0, x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
      { t: 1, x: 0.7, y: 0.5, w: 0.3, h: 0.3 },
      { t: 2, x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
    ];
    const out = smoothTrack(raw, 1);
    expect(out).toHaveLength(3);
    expect(out[0].t).toBe(0);
    expect(out[2].t).toBe(2);
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
    }
  });

  it("fills gaps with interpolation", () => {
    const track: TrackPoint[] = [
      { t: 0, x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
      { t: 4, x: 0.8, y: 0.8, w: 0.3, h: 0.3 },
    ];
    const out = fillGaps(track, 1.5);
    expect(out.length).toBeGreaterThan(2);
    expect(out[out.length - 1]).toEqual(track[1]);
  });

  it("normalizes unsorted tracks", () => {
    const raw: TrackPoint[] = [
      { t: 2, x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
      { t: 0, x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
    ];
    const out = normalizeTrack(raw);
    expect(out[0].t).toBe(0);
    expect(out[1].t).toBe(2);
  });
});

describe("buildCropExpression", () => {
  it("returns null when reframe is off", () => {
    expect(buildCropExpression({ ...DEFAULT_REFRAME, enabled: false }, 9 / 16)).toBeNull();
  });

  it("emits a constant crop for center mode", () => {
    const expr = buildCropExpression(
      { ...DEFAULT_REFRAME, enabled: true, mode: "center", scale: 1.5 },
      9 / 16
    );
    expect(expr).toMatch(/^crop=\d+:\d+:\d+:\d+$/);
  });

  it("emits a piecewise-linear expression for tracked mode", () => {
    const expr = buildCropExpression(
      {
        ...DEFAULT_REFRAME,
        enabled: true,
        mode: "tracked",
        scale: 1.6,
        track: [
          { t: 0, x: 0.3, y: 0.4, w: 0.3, h: 0.3 },
          { t: 5, x: 0.7, y: 0.6, w: 0.3, h: 0.3 },
          { t: 10, x: 0.4, y: 0.5, w: 0.3, h: 0.3 },
        ],
      },
      9 / 16
    );
    expect(expr).toContain("if(lt(t,");
    expect(expr).toContain("max(0,min(");
    expect(expr).toContain("crop=");
  });

  it("keeps the window inside the frame for extreme subject positions", () => {
    const expr = buildCropExpression(
      {
        ...DEFAULT_REFRAME,
        enabled: true,
        mode: "tracked",
        scale: 2,
        track: [
          { t: 0, x: 0.0, y: 0.0, w: 0.3, h: 0.3 },
          { t: 2, x: 1.0, y: 1.0, w: 0.3, h: 0.3 },
          { t: 4, x: 0.0, y: 0.0, w: 0.3, h: 0.3 },
        ],
      },
      9 / 16,
      1920,
      1080
    );
    // 9:16 from 16:9 at scale 2 → cropW = (1080*0.5625)/2 = 303.75,
    // so the horizontal offset range is 0..1616.
    expect(expr).toContain("min(1616,");
    expect(expr).toContain("max(0,");
  });
});
