import type { CaptionLine, VisualEvent } from "@/lib/types";
import { clamp } from "@/lib/analysis/util";

export interface Candidate { start: number; end: number; }
const SNAP_RADIUS = 1.5;
const SILENCE_SNAP_RADIUS = 0.9;

export function snapToWord(t: number, words: CaptionLine[], radius = SNAP_RADIUS): number | null {
  let best: number | null = null, bestDist = Infinity;
  for (const line of words) for (const w of line.words) for (const b of [w.start, w.end]) {
    const d = Math.abs(b - t);
    if (d < bestDist && d <= radius) { bestDist = d; best = b; }
  }
  return best;
}

export function wordBoundaries(words: CaptionLine[]): number[] {
  const set = new Set<number>();
  for (const line of words) for (const w of line.words) {
    set.add(w.start);
    set.add(w.end);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function nearestSilenceEdge(t: number, silence: { start: number; end: number }[], radius = SILENCE_SNAP_RADIUS): number {
  let best = t, bestDist = radius + Number.EPSILON;
  for (const s of silence) for (const b of [s.start, s.end]) {
    const d = Math.abs(b - t);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}

function semanticAnchors(transcript: CaptionLine[] | null): number[] {
  if (!transcript?.length) return [];
  const anchors: number[] = [];
  const hook = /(why|how|what|wait|listen|imagine|secret|mistake|lesson|changed everything|nobody talks about|i figured out|the one thing|you need to know)/i;
  for (const line of transcript) {
    const text = line.text.trim();
    if (/[.!?]$/.test(text) || hook.test(text) || /\b\d+(?:[.,]\d+)?\b/.test(text)) {
      anchors.push((line.start + line.end) / 2);
    }
  }
  return anchors;
}

function normalizeWindow(start: number, end: number, duration: number, lo: number, hi: number, minLen: number): Candidate | null {
  let s = clamp(start, 0, Math.max(0, duration - minLen));
  let e = clamp(end, s + minLen, duration);
  let len = e - s;

  // Preserve the intended center while enforcing the target length. Do not
  // blindly extend the end after snapping: that can undo a clean boundary.
  if (len < lo) {
    const need = lo - len;
    const growLeft = Math.min(s, need / 2);
    s -= growLeft;
    e = Math.min(duration, e + (need - growLeft));
    if (e - s < lo) s = Math.max(0, e - lo);
  }
  len = e - s;
  if (len > hi) {
    const center = (s + e) / 2;
    s = Math.max(0, center - hi / 2);
    e = Math.min(duration, s + hi);
    if (e - s < hi) s = Math.max(0, e - hi);
  }

  if (e - s < Math.min(lo, duration) * 0.95 || e - s > hi * 1.05) return null;
  return { start: Number(s.toFixed(3)), end: Number(e.toFixed(3)) };
}

/**
 * Event-aware candidate generator. Candidate boundaries are optimized rather
 * than modified sequentially, so word/silence snapping cannot accidentally
 * push a candidate outside the requested duration range.
 */
export function generateCandidates(
  duration: number,
  targetLen: number,
  silence: { start: number; end: number }[],
  transcript: CaptionLine[] | null,
  opts: { step?: number; slack?: number; minLen?: number; visualEvents?: VisualEvent[] } = {}
): Candidate[] {
  const step = Math.max(0.5, opts.step ?? 2);
  const slack = Math.max(0, Math.min(0.45, opts.slack ?? 0.12));
  const minLen = Math.max(0.5, opts.minLen ?? 3);
  if (duration <= minLen + 0.5) return duration > 0 ? [{ start: 0, end: duration }] : [];

  const target = Math.max(minLen, Math.min(duration, targetLen));
  const lo = Math.min(duration, target * (1 - slack));
  const hi = Math.min(duration, Math.max(lo, target * (1 + slack)));
  const centers: number[] = [];

  for (let s = target / 2; s < duration; s += step) centers.push(s);
  for (const t of semanticAnchors(transcript)) centers.push(t);
  for (const e of opts.visualEvents ?? []) {
    if (e.change >= 0.28 || e.face) centers.push(e.time);
  }
  centers.sort((a, b) => a - b);

  const out: Candidate[] = [];
  const seen = new Set<string>();
  const words = transcript?.length ? transcript : null;

  for (const center of centers) {
    let start = center - target / 2;
    let end = center + target / 2;

    // Evaluate several boundary strategies instead of applying every snap in
    // sequence. The best valid strategy keeps the candidate closest to the
    // target center and requested duration.
    const startOptions = [start];
    const endOptions = [end];
    if (words) {
      const ws = snapToWord(start, words);
      const we = snapToWord(end, words);
      if (ws !== null) startOptions.push(ws);
      if (we !== null) endOptions.push(we);
    }
    const ss = nearestSilenceEdge(start, silence);
    const se = nearestSilenceEdge(end, silence);
    if (ss !== start) startOptions.push(ss);
    if (se !== end) endOptions.push(se);

    let best: Candidate | null = null;
    let bestCost = Infinity;
    for (const s0 of startOptions) for (const e0 of endOptions) {
      const candidate = normalizeWindow(s0, e0, duration, lo, hi, minLen);
      if (!candidate) continue;
      const c = (Math.abs(((candidate.start + candidate.end) / 2) - center) / Math.max(target, 1)) * 2
        + Math.abs((candidate.end - candidate.start) - target) / Math.max(target, 1);
      if (c < bestCost) {
        bestCost = c;
        best = candidate;
      }
    }

    if (!best) continue;
    const key = `${best.start.toFixed(2)}:${best.end.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(best);
  }

  return out;
}
