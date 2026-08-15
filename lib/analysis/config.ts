import type { ClipLength } from "@/lib/types";
import type { HighlightReasonKey } from "@/lib/analysis/types";

/**
 * Scoring weights for the local highlight engine.
 *
 * Each signal is normalized to [0, 1]; the final score is their weighted
 * average scaled to [0, 100]. Weights sum to 1.
 *
 *   speech      — how much of the window contains actual speech (vs dead air)
 *   energy      — loudness relative to the video's own baseline (peaks/mean)
 *   pacing      — speech density + envelope transitions + words-per-minute
 *   silence     — clean gaps: no long internal pauses, boundaries near silence
 *   quotability — linguistic cues from the transcript (questions, numbers,
 *                 superlatives, hooks, first-person statements)
 *   completeness— window starts/ends at word or speech boundaries, not mid-sentence
 *   boundary    — crisp cut points (near silence edges)
 *
 * When no transcript exists, `quotability` collapses to 0 and the remaining
 * weights are re-normalized automatically.
 */
export interface ScoringWeights {
  speech: number;
  energy: number;
  pacing: number;
  silence: number;
  quotability: number;
  completeness: number;
  boundary: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  speech: 0.18,
  energy: 0.17,
  pacing: 0.14,
  silence: 0.16,
  quotability: 0.18,
  completeness: 0.09,
  boundary: 0.08,
};

export const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as (keyof ScoringWeights)[];

export interface AnalysisConfig {
  weights: ScoringWeights;
  /** Minimum clip length, seconds. */
  minClipSec: number;
  /** Sliding-window step while generating candidates, seconds. */
  candidateStepSec: number;
  /** Allowed duration slack around the target length, fraction. */
  lengthSlack: number;
  /** Temporal IoU above which two candidates are considered the same moment. */
  overlapIoU: number;
  /** Minimum score (0–100) a candidate needs to be considered. */
  minScore: number;
  /** How close (s) a window edge must be to a silence edge to count as a crisp cut. */
  boundaryRadiusSec: number;
  /** Longest tolerable internal pause inside a window, fraction of window length. */
  maxInternalSilenceRatio: number;
  /** Confidence floor for the "clear winner" confidence measure. */
  confidenceFloor: number;
}

export const DEFAULT_CONFIG: AnalysisConfig = {
  weights: DEFAULT_WEIGHTS,
  minClipSec: 5,
  candidateStepSec: 2,
  lengthSlack: 0.12,
  overlapIoU: 0.5,
  minScore: 18,
  boundaryRadiusSec: 0.7,
  maxInternalSilenceRatio: 0.4,
  confidenceFloor: 0.15,
};

export interface ClipLengthOption {
  value: ClipLength;
  label: string;
}

export const CLIP_LENGTH_OPTIONS: ClipLengthOption[] = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
];

export interface ReasonSpec {
  key: HighlightReasonKey;
  label: string;
  emoji: string;
  /** Subjective priority when multiple reasons tie. */
  priority: number;
}

export const REASON_SPECS: ReasonSpec[] = [
  { key: "energy", label: "High Energy", emoji: "🔥", priority: 1 },
  { key: "question", label: "Strong Question", emoji: "❓", priority: 2 },
  { key: "statement", label: "Strong Statement", emoji: "🎯", priority: 3 },
  { key: "quote", label: "Great Quote", emoji: "💬", priority: 4 },
  { key: "surprise", label: "Surprising", emoji: "😮", priority: 5 },
  { key: "insight", label: "Valuable Insight", emoji: "🧠", priority: 6 },
  { key: "pacing", label: "Fast-Paced", emoji: "⚡", priority: 7 },
  { key: "hook", label: "Strong Hook", emoji: "🪝", priority: 8 },
  { key: "story", label: "Story Beat", emoji: "📖", priority: 9 },
  { key: "general", label: "Must-Watch Moment", emoji: "✨", priority: 10 },
];

export function reasonSpec(key: HighlightReasonKey): ReasonSpec {
  return REASON_SPECS.find((r) => r.key === key) ?? REASON_SPECS[REASON_SPECS.length - 1];
}

/** Keep only the enabled weight keys (e.g. drop quotability without a transcript). */
export function normalizeWeights(weights: ScoringWeights, keys: (keyof ScoringWeights)[]): ScoringWeights {
  const total = keys.reduce((t, k) => t + weights[k], 0);
  if (total <= 0) return weights;
  const out = { ...weights };
  for (const k of WEIGHT_KEYS) out[k] = keys.includes(k) ? weights[k] / total : 0;
  return out;
}
