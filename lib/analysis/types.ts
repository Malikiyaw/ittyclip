import type { CaptionLine, ClipLength, VisualEvent, Moment } from "@/lib/types";

export interface HighlightScore {
  speech: number;
  energy: number;
  pacing: number;
  silence: number;
  quotability: number;
  completeness: number;
  boundary: number;
  /** Optional for legacy saved projects; new analysis always populates it. */
  visual?: number;
  total: number;
}

export interface HighlightReason { key: HighlightReasonKey; label: string; emoji: string; }
export type HighlightReasonKey = "energy" | "statement" | "quote" | "question" | "surprise" | "pacing" | "insight" | "story" | "hook" | "general";
export type HighlightSource = "ai" | "local";
export interface RankedHighlight extends Moment { rank: number; reason: HighlightReason; transcript: string | null; breakdown: HighlightScore; confidence: number; source: HighlightSource; }

export interface AnalysisInput {
  envelope: Float32Array;
  hopSec: number;
  duration: number;
  silence: { start: number; end: number }[];
  transcript: CaptionLine[] | null;
  visualEvents?: VisualEvent[];
  clipLength: ClipLength;
  maxResults: number;
  onProgress?: (p: number, stage: string) => void;
  signal?: AbortSignal;
}
