import type { CaptionLine, VisualEvent } from "@/lib/types";
import { clamp } from "@/lib/analysis/util";

export interface Candidate { start: number; end: number; }
const SNAP_RADIUS = 1.5;
const SILENCE_SNAP_RADIUS = 0.9;

export function snapToWord(t: number, words: CaptionLine[], radius = SNAP_RADIUS): number | null {
  let best: number | null = null, bestDist = Infinity;
  for (const line of words) for (const w of line.words) for (const b of [w.start, w.end]) {
    const d = Math.abs(b - t); if (d < bestDist && d <= radius) { bestDist = d; best = b; }
  }
  return best;
}

export function wordBoundaries(words: CaptionLine[]): number[] {
  const set = new Set<number>(); for (const line of words) for (const w of line.words) set.add(w.start);
  return Array.from(set).sort((a, b) => a - b);
}

export function nearestSilenceEdge(t: number, silence: { start: number; end: number }[], radius = SILENCE_SNAP_RADIUS): number {
  let best = t, bestDist = radius + Number.EPSILON;
  for (const s of silence) for (const b of [s.start, s.end]) { const d = Math.abs(b - t); if (d < bestDist) { bestDist = d; best = b; } }
  return best;
}

function semanticAnchors(transcript: CaptionLine[] | null): number[] {
  if (!transcript?.length) return [];
  const anchors: number[] = [];
  const hook = /(why|how|what|wait|listen|imagine|secret|mistake|lesson|changed everything|nobody talks about|i figured out|the one thing|you need to know)/i;
  for (const line of transcript) {
    const text = line.text.trim();
    if (/[.!?]$/.test(text) || hook.test(text) || /\b\d+(?:[.,]\d+)?\b/.test(text)) anchors.push((line.start + line.end) / 2);
  }
  return anchors;
}

/**
 * Event-aware candidate generator. It still keeps a sparse fallback grid, but
 * high-information transcript/visual events get their own candidate centers.
 */
export function generateCandidates(
  duration: number,
  targetLen: number,
  silence: { start: number; end: number }[],
  transcript: CaptionLine[] | null,
  opts: { step?: number; slack?: number; minLen?: number; visualEvents?: VisualEvent[] } = {}
): Candidate[] {
  const step = opts.step ?? 2, slack = opts.slack ?? 0.12, minLen = opts.minLen ?? 3;
  if (duration <= minLen + 0.5) return duration > 0 ? [{ start: 0, end: duration }] : [];
  const lo = Math.min(duration, targetLen * (1 - slack)), hi = Math.min(duration, targetLen * (1 + slack));
  const words = transcript?.length ? wordBoundaries(transcript) : null;
  const centers: number[] = [];
  for (let s = targetLen / 2; s < duration; s += step) centers.push(s);
  for (const t of semanticAnchors(transcript)) centers.push(t);
  for (const e of opts.visualEvents ?? []) if (e.change >= 0.28 || e.face) centers.push(e.time);
  centers.sort((a, b) => a - b);

  const out: Candidate[] = [], seen = new Set<string>();
  for (const center of centers) {
    let start = center - targetLen / 2, end = center + targetLen / 2;
    if (words?.length) { const ws = snapToWord(start, transcript!); const we = snapToWord(end, transcript!); if (ws !== null) start = ws; if (we !== null) end = we; }
    start = nearestSilenceEdge(start, silence); end = nearestSilenceEdge(end, silence);
    if (end - start < lo) end = start + lo;
    if (end - start > hi) end = start + hi;
    if (end > duration) { end = duration; start = Math.max(0, end - hi); }
    start = clamp(start, 0, Math.max(0, duration - minLen)); end = clamp(end, start + minLen, duration);
    if (end - start < lo * 0.95 || end - start > hi * 1.05) continue;
    const key = `${start.toFixed(2)}:${end.toFixed(2)}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ start, end });
  }
  return out;
}
