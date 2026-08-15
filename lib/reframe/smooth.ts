import type { TrackPoint } from "@/lib/reframe/state";

/**
 * Smooths a raw subject track with a moving average, clamps positions to the
 * frame, and interpolates gaps where detection failed.
 */
export function smoothTrack(raw: TrackPoint[], window = 5): TrackPoint[] {
  if (raw.length === 0) return [];
  const n = raw.length;
  const out: TrackPoint[] = [];

  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(n - 1, i + window);
    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      x += raw[j].x;
      y += raw[j].y;
      w += raw[j].w;
      h += raw[j].h;
      count++;
    }
    out.push({
      t: raw[i].t,
      x: clamp01(x / count),
      y: clamp01(y / count),
      w: clamp01(w / count),
      h: clamp01(h / count),
    });
  }

  // Clamp box into the frame (center may drift near edges after smoothing).
  return out.map((p) => {
    const x = Math.max(0, Math.min(1, p.x));
    const y = Math.max(0, Math.min(1, p.y));
    return { ...p, x, y, w: Math.max(0.05, p.w), h: Math.max(0.05, p.h) };
  });
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Fills gaps between track points with linear interpolation. Used when
 * detection fails for stretches (faces turned away, occlusions).
 */
export function fillGaps(track: TrackPoint[], maxGapSec = 1.5): TrackPoint[] {
  if (track.length < 2) return track;
  const out: TrackPoint[] = [track[0]];
  for (let i = 1; i < track.length; i++) {
    const gap = track[i].t - track[i - 1].t;
    if (gap > maxGapSec) {
      const steps = Math.min(30, Math.round(gap / 0.5));
      for (let s = 1; s < steps; s++) {
        const f = s / steps;
        const a = track[i - 1];
        const b = track[i];
        out.push({
          t: a.t + (b.t - a.t) * f,
          x: a.x + (b.x - a.x) * f,
          y: a.y + (b.y - a.y) * f,
          w: a.w + (b.w - a.w) * f,
          h: a.h + (b.h - a.h) * f,
        });
      }
    }
    out.push(track[i]);
  }
  return out;
}

/** Normalizes a raw track: sort by time, drop near-duplicates. */
export function normalizeTrack(raw: TrackPoint[]): TrackPoint[] {
  const sorted = [...raw].sort((a, b) => a.t - b.t);
  const out: TrackPoint[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (!last || p.t - last.t > 0.02) out.push(p);
  }
  return out;
}
