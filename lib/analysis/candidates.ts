import type { CaptionLine } from "@/lib/types";
import { clamp } from "@/lib/analysis/util";

export interface Candidate {
  start: number;
  end: number;
}

const SNAP_RADIUS = 1.5;

/**
 * Nearest transcript word boundary to `t` within `radius` seconds.
 * Prefers the boundary with the smallest distance; returns null when no
 * word boundary is close enough.
 */
export function snapToWord(t: number, words: CaptionLine[], radius = SNAP_RADIUS): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const line of words) {
    for (const w of line.words) {
      for (const b of [w.start, w.end]) {
        const d = Math.abs(b - t);
        if (d < bestDist && d <= radius) {
          bestDist = d;
          best = b;
        }
      }
    }
  }
  return best;
}

/** Build word-start boundaries sorted ascending, deduplicated. */
export function wordBoundaries(words: CaptionLine[]): number[] {
  const set = new Set<number>();
  for (const line of words) {
    for (const w of line.words) set.add(w.start);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Nearest silence edge (start or end of a silence segment) to `t`. */
export function nearestSilenceEdge(t: number, silence: { start: number; end: number }[]): number {
  let best = t;
  let bestDist = Infinity;
  for (const s of silence) {
    for (const b of [s.start, s.end]) {
      const d = Math.abs(b - t);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
  }
  return best;
}

/**
 * Generates candidate clip windows for a target length.
 *
 * Windows slide across the timeline with `step` seconds. Each window is then
 * snapped to the nearest silence edge (and word boundary when a transcript
 * exists) so cuts never land mid-word. The final window length is allowed to
 * drift within `slack` of the target so snaps can still take effect.
 */
export function generateCandidates(
  duration: number,
  targetLen: number,
  silence: { start: number; end: number }[],
  transcript: CaptionLine[] | null,
  opts: { step?: number; slack?: number; minLen?: number } = {}
): Candidate[] {
  const step = opts.step ?? 2;
  const slack = opts.slack ?? 0.12;
  const minLen = opts.minLen ?? 3;
  if (duration <= minLen + 0.5) return duration > 0 ? [{ start: 0, end: duration }] : [];

  const lo = Math.min(duration, targetLen * (1 - slack));
  const hi = Math.min(duration, targetLen * (1 + slack));
  const out: Candidate[] = [];
  const words = transcript && transcript.length > 0 ? wordBoundaries(transcript) : null;

  for (let s = 0; s + minLen <= duration; s += step) {
    let start = s;
    let end = s + targetLen;

    if (words && words.length > 0) {
      const ws = snapToWord(start, transcript!);
      if (ws !== null) start = ws;
      const we = snapToWord(end, transcript!);
      if (we !== null) end = we;
    }

    start = nearestSilenceEdge(start, silence);
    end = nearestSilenceEdge(end, silence);

    // Enforce the allowed length band.
    if (end - start < lo) end = start + lo;
    if (end - start > hi) end = start + hi;
    if (end > duration) {
      end = duration;
      start = Math.max(0, end - hi);
    }
    if (start < 0) start = 0;

    start = clamp(start, 0, Math.max(0, duration - minLen));
    end = clamp(end, start + minLen, duration);

    const last = out[out.length - 1];
    if (!last || start - last.start > 0.05) {
      out.push({ start, end });
    }
  }
  return out;
}
