import { uid } from "@/lib/types";
import type { AnalysisInput, RankedHighlight } from "@/lib/analysis/types";
import { generateCandidates } from "@/lib/analysis/candidates";
import { computeGlobalStats, scoreWindow } from "@/lib/analysis/scoring";
import { nonMaxSuppression } from "@/lib/analysis/overlap";
import { pickReason } from "@/lib/analysis/reasons";
import { clamp, mean } from "@/lib/analysis/util";

const STAGES: [number, string][] = [[0.05, "Generating candidates"], [0.35, "Scoring windows"], [0.85, "Removing overlaps"], [1, "Ranking results"]];

export function runHighlightAnalysis(input: AnalysisInput): RankedHighlight[] {
  const { envelope, hopSec, duration, silence, transcript, visualEvents, clipLength } = input;
  const emit = (idx: number) => { if (!input.signal?.aborted) input.onProgress?.(...(STAGES[idx] ?? STAGES[STAGES.length - 1])); };
  emit(0);
  const global = computeGlobalStats(envelope);
  const candidates = generateCandidates(duration, clipLength, silence, transcript, { step: 2, slack: 0.12, minLen: 3, visualEvents });
  emit(1);
  const scored = candidates.map((c) => ({ ...c, breakdown: scoreWindow({ env: envelope, hopSec, global, silence, transcript, visualEvents, start: c.start, end: c.end, boundaryRadiusSec: 0.7, maxInternalSilenceRatio: 0.4 }) }));
  emit(2);
  const aboveFloor = scored.filter((c) => c.breakdown.total >= 18);
  const deduped = nonMaxSuppression(aboveFloor.sort((a, b) => b.breakdown.total - a.breakdown.total), 0.5);
  emit(3);
  return deduped.slice(0, input.maxResults).map((c, i) => {
    const reasons = pickReason({ breakdown: c.breakdown, transcript, start: c.start, end: c.end });
    // `visual` was added after the original local scoring model. Legacy
    // highlights and older saved projects may not contain it, so normalize
    // the optional field to zero before calculating confidence statistics.
    const signals = [
      c.breakdown.speech,
      c.breakdown.energy,
      c.breakdown.pacing,
      c.breakdown.silence,
      c.breakdown.quotability,
      c.breakdown.completeness,
      c.breakdown.boundary,
      c.breakdown.visual ?? 0,
    ];
    const m = mean(signals);
    const spread = Math.sqrt(mean(signals.map((s) => (s - m) * (s - m))));
    const confidence = clamp(1 - spread / 34, 0.15, 1);
    const text = transcript?.filter((l) => l.end > c.start && l.start < c.end).map((l) => l.text).join(" ").replace(/\s+/g, " ").trim() || null;
    return { id: uid(), start: c.start, end: c.end, score: c.breakdown.total, label: `Highlight ${i + 1}`, rank: i + 1, reason: reasons, transcript: text ? text.slice(0, 220) : null, breakdown: c.breakdown, confidence, source: "local" as const };
  });
}

export async function analyzeHighlights(input: AnalysisInput): Promise<RankedHighlight[]> { return runHighlightAnalysis(input); }
