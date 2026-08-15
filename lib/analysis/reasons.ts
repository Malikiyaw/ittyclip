import { REASON_SPECS, reasonSpec, type ReasonSpec } from "@/lib/analysis/config";
import type { HighlightReason, HighlightReasonKey, HighlightScore } from "@/lib/analysis/types";
import { analyzeCues, windowText, type CueAnalysis } from "@/lib/analysis/scoring";
import type { CaptionLine } from "@/lib/types";

interface ReasonInput {
  breakdown: HighlightScore;
  transcript: CaptionLine[] | null;
  start: number;
  end: number;
}

interface SignalStrength {
  key: HighlightReasonKey;
  label: string;
  strength: number;
}

/**
 * Picks the primary reason for a highlight from its actual signal breakdown.
 * The strongest normalized signal wins; ties break on a fixed priority order.
 * Without a transcript, linguistic reasons are never chosen.
 */
export function pickReason(input: ReasonInput): HighlightReason {
  const b = input.breakdown;
  const hasText = !!input.transcript && input.transcript.length > 0;
  const cues: CueAnalysis | null = hasText
    ? analyzeCues(windowText(input.start, input.end, input.transcript))
    : null;

  const strengths: SignalStrength[] = [
    { key: "energy", label: "High Energy", strength: b.energy },
    { key: "pacing", label: "Fast-Paced", strength: b.pacing },
    { key: "statement", label: "Strong Statement", strength: (b.speech + b.energy) * 0.5 },
  ];

  if (cues) {
    if (cues.question) strengths.push({ key: "question", label: "Strong Question", strength: b.quotability + 0.08 });
    if (cues.hasNumbers) strengths.push({ key: "statement", label: "Strong Statement", strength: b.quotability + 0.04 });
    if (cues.cueScore > 0.55) strengths.push({ key: "quote", label: "Great Quote", strength: b.quotability });
    if (cues.cueScore > 0.7) strengths.push({ key: "surprise", label: "Surprising", strength: b.quotability + 0.06 });
    if (b.quotability >= 60) strengths.push({ key: "insight", label: "Valuable Insight", strength: b.quotability * 0.9 });
    if (b.quotability >= 65 && b.boundary >= 55) strengths.push({ key: "hook", label: "Strong Hook", strength: b.quotability * 0.85 });
    if (b.pacing >= 55 && b.energy >= 50) strengths.push({ key: "story", label: "Story Beat", strength: (b.pacing + b.energy) * 0.5 });
  }

  strengths.sort(
    (a, z) =>
      z.strength - a.strength ||
      priorityOf(a.key) - priorityOf(z.key)
  );

  const winner = strengths[0];
  const base = winner ? winner : { key: "general" as HighlightReasonKey, strength: 0, label: "Must-Watch Moment" };

  // Guard: if the strongest signal is still weak, fall back to a generic label.
  if (base.strength < 42) return reasonSpec("general");
  return reasonSpec(base.key);
}

function priorityOf(key: HighlightReasonKey): number {
  const spec = REASON_SPECS.find((r) => r.key === key) as ReasonSpec | undefined;
  return spec?.priority ?? 10;
}
