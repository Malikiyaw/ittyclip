import type { CaptionLine, VisualEvent } from "@/lib/types";
import { clamp } from "@/lib/analysis/util";
import type { HighlightScore } from "@/lib/analysis/types";

export interface WindowStats {
  activity: number; quietRatio: number; mean: number; peak: number; variance: number;
  transitionsPerSec: number; longestQuietSec: number;
}
export interface GlobalStats { p95: number; mean: number; max: number; speechFloor: number; quietFloor: number; }

export function computeGlobalStats(env: Float32Array): GlobalStats {
  const sorted = Array.from(env).sort((a, b) => b - a);
  const p95 = sorted[Math.floor(sorted.length * 0.05)] || 0.001;
  const mean = sorted.reduce((s, v) => s + v, 0) / Math.max(1, sorted.length);
  const max = sorted[0] || 0.001;
  const floor = Math.max(0.0018, p95 * 0.14);
  return { p95, mean, max, speechFloor: floor, quietFloor: floor };
}

const HOP_SEC_DEFAULT = 0.05;
export function computeWindowStats(env: Float32Array, a: number, b: number, global: GlobalStats, hopSec = HOP_SEC_DEFAULT): WindowStats {
  const i0 = Math.max(0, Math.floor(a / hopSec));
  const i1 = Math.min(env.length, Math.ceil(b / hopSec));
  if (i1 <= i0) return { activity: 0, quietRatio: 1, mean: 0, peak: 0, variance: 0, transitionsPerSec: 0, longestQuietSec: 0 };
  let sum = 0, sumSq = 0, peak = 0, active = 0, quiet = 0, transitions = 0, longestQuiet = 0, run = 0;
  let prevQuiet = false;
  for (let i = i0; i < i1; i++) {
    const v = env[i]; sum += v; sumSq += v * v; if (v > peak) peak = v;
    const isQuiet = v < global.quietFloor;
    if (isQuiet) { quiet++; run++; if (run > longestQuiet) longestQuiet = run; }
    else { active++; if (run > 0) { if (i > i0) transitions++; run = 0; } if (prevQuiet && i > i0) transitions++; }
    if (i > i0 && isQuiet !== prevQuiet) transitions++;
    prevQuiet = isQuiet;
  }
  const n = i1 - i0; const mean = sum / n; const variance = Math.max(0, sumSq / n - mean * mean);
  const duration = n * hopSec;
  return { activity: active / n, quietRatio: quiet / n, mean, peak, variance, transitionsPerSec: duration > 0 ? transitions / duration : 0, longestQuietSec: longestQuiet * hopSec };
}

export function wordsPerMinute(a: number, b: number, transcript: CaptionLine[] | null): number {
  if (!transcript?.length) return 0;
  let words = 0;
  for (const line of transcript) {
    if (line.end < a || line.start > b) continue;
    const ws = Math.max(line.start, a), we = Math.min(line.end, b);
    for (const w of line.words) {
      if (w.end < ws || w.start > we) continue;
      words += clamp((Math.min(w.end, we) - Math.max(w.start, ws)) / Math.max(0.001, w.end - w.start), 0, 1);
    }
  }
  const dur = b - a; return dur > 0 ? (words / dur) * 60 : 0;
}

export function cutsThroughWord(a: number, b: number, transcript: CaptionLine[] | null): { start: boolean; end: boolean } {
  if (!transcript) return { start: false, end: false };
  for (const line of transcript) for (const w of line.words) if (w.start < a && w.end > a + 0.1) return { start: true, end: false };
  for (const line of transcript) for (const w of line.words) if (w.start < b - 0.1 && w.end > b) return { start: false, end: true };
  return { start: false, end: false };
}

const SUPERLATIVES = ["best", "worst", "greatest", "biggest", "smallest", "craziest", "wildest", "never", "always", "literally", "actually", "secret", "surprisingly", "incredibly", "amazing", "insane", "impossible", "guaranteed"];
const HOOK_WORDS = ["remember", "listen", "watch", "stop", "imagine", "think", "wait", "the one thing", "you need to know", "changed everything", "game changer", "i figured out", "took me", "nobody talks about", "everyone says"];
const DIRECTIVE_WORDS = ["secret", "trick", "hack", "mistake", "lesson", "rule", "formula"];

export interface CueAnalysis { cueScore: number; question: boolean; hasNumbers: boolean; firstPerson: boolean; excerpt: string; }
export function analyzeCues(text: string): CueAnalysis {
  const clean = text.replace(/\s+/g, " ").trim(), lower = clean.toLowerCase(), words = clean.split(/\s+/).filter(Boolean);
  let cueCount = 0;
  for (const s of SUPERLATIVES) if (lower.includes(s)) cueCount++;
  for (const h of HOOK_WORDS) if (lower.includes(h)) cueCount += 2;
  for (const d of DIRECTIVE_WORDS) if (lower.includes(d)) cueCount++;
  const question = /\?\s*$/.test(clean) || /(^|\s)(why|how|what|when|where|who|did|does|is|are|can|could|would)\s/i.test(clean);
  const hasNumbers = /\b\d+([.,]\d+)?\b/.test(clean), firstPerson = /(^|\s)(i|i'm|i've|i'd|my|we|we're|our)\s/i.test(clean);
  if (hasNumbers) cueCount++; if (firstPerson) cueCount += 0.5;
  return { cueScore: clamp(cueCount / 3.5, 0, 1), question, hasNumbers, firstPerson, excerpt: clean.slice(0, 180) };
}
export function windowText(a: number, b: number, transcript: CaptionLine[] | null): string {
  if (!transcript) return "";
  return transcript.filter((l) => l.end > a && l.start < b).map((l) => l.text).join(" ").replace(/\s+/g, " ").trim().slice(0, 180);
}

export interface ScoreInput {
  env: Float32Array; hopSec: number; global: GlobalStats; silence: { start: number; end: number }[];
  transcript: CaptionLine[] | null; visualEvents?: VisualEvent[]; start: number; end: number;
  boundaryRadiusSec: number; maxInternalSilenceRatio: number;
}

function visualScore(a: number, b: number, events?: VisualEvent[]): number {
  if (!events?.length) return 0.5;
  const inside = events.filter((e) => e.time >= a && e.time <= b);
  if (!inside.length) return 0.35;
  const change = inside.reduce((s, e) => s + e.change, 0) / inside.length;
  const face = inside.filter((e) => e.face).length / inside.length;
  // A visible change or a face gives the clip a small editorial boost, not a
  // dominant score, so audio/semantic signals remain the authority.
  return clamp(0.7 * change + 0.3 * face + 0.2, 0, 1);
}

export function scoreWindow(input: ScoreInput): HighlightScore {
  const { env, hopSec, global, silence, transcript, start, end } = input;
  const stats = computeWindowStats(env, start, end, global, hopSec), dur = Math.max(0.1, end - start), p95 = Math.max(0.001, global.p95);
  const speech = clamp(stats.activity * 1.4 - 0.15, 0, 1);
  const meanNorm = stats.mean / p95, peakNorm = stats.peak / p95;
  const energy = clamp(0.35 * meanNorm * 1.6 + 0.65 * peakNorm * 0.85, 0, 1);
  const tpsNorm = clamp(stats.transitionsPerSec / 2.5, 0, 1), varNorm = clamp(Math.sqrt(stats.variance) / (p95 * 0.55), 0, 1), wpmNorm = clamp(wordsPerMinute(start, end, transcript) / 220, 0, 1);
  const pacing = transcript?.length ? clamp(0.35 * tpsNorm + 0.3 * varNorm + 0.35 * wpmNorm, 0, 1) : clamp(0.55 * tpsNorm + 0.45 * varNorm, 0, 1);
  const internalGapRatio = stats.quietRatio * 0.55 + (stats.longestQuietSec / Math.max(0.5, dur)) * 0.45;
  const silenceScore = clamp(1 - clamp(internalGapRatio / input.maxInternalSilenceRatio, 0, 1) * 0.8, 0, 1);
  const cues = analyzeCues(windowText(start, end, transcript));
  let quotability = 0;
  if (transcript?.length) { let q = cues.cueScore * 0.6; if (cues.question) q += 0.2; if (cues.hasNumbers) q += 0.1; if (cues.firstPerson) q += 0.1; quotability = clamp(q, 0, 1); }
  let completeness = 0.5;
  if (transcript?.length) { const cut = cutsThroughWord(start, end, transcript); completeness = 0.5 * (cut.start ? 0 : 1) + 0.5 * (cut.end ? 0 : 1); }
  else { const sEdge = silenceDistance(start, silence), eEdge = silenceDistance(end, silence); completeness = 0.5 * (sEdge <= input.boundaryRadiusSec ? 1 : 0.35) + 0.5 * (eEdge <= input.boundaryRadiusSec ? 1 : 0.35); }
  const sEdge = silenceDistance(start, silence), eEdge = silenceDistance(end, silence);
  const boundary = clamp(0.5 * clamp(1 - sEdge / (input.boundaryRadiusSec * 2), 0.25, 1) + 0.5 * clamp(1 - eEdge / (input.boundaryRadiusSec * 2), 0.25, 1), 0, 1);
  const visual = visualScore(start, end, input.visualEvents);
  const total = Math.round((speech * 0.17 + energy * 0.16 + pacing * 0.13 + silenceScore * 0.15 + quotability * 0.18 + completeness * 0.09 + boundary * 0.07 + visual * 0.05) * 100);
  return { speech: Math.round(speech * 100), energy: Math.round(energy * 100), pacing: Math.round(pacing * 100), silence: Math.round(silenceScore * 100), quotability: Math.round(quotability * 100), completeness: Math.round(completeness * 100), boundary: Math.round(boundary * 100), visual: Math.round(visual * 100), total };
}

function silenceDistance(t: number, silence: { start: number; end: number }[]): number {
  let best = Infinity;
  for (const s of silence) best = Math.min(best, Math.abs(t - s.start), Math.abs(t - s.end));
  return isFinite(best) ? best : 1e9;
}
