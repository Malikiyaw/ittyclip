import type { CaptionLine, ClipLength, VisualEvent } from "@/lib/types";
import { uid } from "@/lib/types";
import type { AnalysisInput, RankedHighlight } from "@/lib/analysis/types";
import { HighlightAnalyzerBase } from "@/lib/analysis/provider";
import { computeGlobalStats, scoreWindow } from "@/lib/analysis/scoring";
import { reasonSpec } from "@/lib/analysis/config";
import { clamp } from "@/lib/analysis/util";
import { trimTranscript, requestAiHighlights } from "@/lib/ai/client";
import { validateAiHighlights } from "@/lib/ai/validate";

type AiInput = AnalysisInput & {
  speech: { start: number; end: number }[];
  energy: { time: number; value: number }[];
  visualEvents?: VisualEvent[];
};

function excerpt(start: number, end: number, transcript: CaptionLine[] | null): string | null {
  if (!transcript) return null;
  const text = transcript
    .filter((l) => l.end > start && l.start < end)
    .map((l) => l.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 220) : null;
}

export class AiHighlightAnalyzer extends HighlightAnalyzerBase {
  readonly name = "ai";

  async analyze(input: AiInput): Promise<RankedHighlight[]> {
    const trimmed = trimTranscript(
      (input.transcript ?? []).map((l) => ({ start: l.start, end: l.end, text: l.text }))
    );

    const response = await requestAiHighlights(
      {
        transcript: trimmed,
        signals: {
          duration: input.duration,
          silence: input.silence,
          speech: input.speech,
          energy: input.energy.slice(0, 120),
          visualEvents: input.visualEvents?.filter((e) => e.change >= 0.12 || e.face).slice(0, 120),
        },
        clipLength: input.clipLength,
        count: input.maxResults,
      },
      input.onProgress
    );

    const { highlights, reason } = validateAiHighlights(
      { highlights: response.highlights },
      input.duration
    );
    if (reason || highlights.length === 0) {
      throw new Error(reason ?? "AI returned no usable highlights.");
    }

    const global = computeGlobalStats(input.envelope);
    return highlights.slice(0, input.maxResults).map((h, i) => {
      const breakdown = scoreWindow({
        env: input.envelope,
        hopSec: input.hopSec,
        global,
        silence: input.silence,
        transcript: input.transcript,
        start: h.start,
        end: h.end,
        boundaryRadiusSec: 0.7,
        maxInternalSilenceRatio: 0.4,
      });
      return {
        id: uid(),
        start: h.start,
        end: h.end,
        score: h.score,
        label: h.title || `Highlight ${i + 1}`,
        rank: i + 1,
        reason: reasonSpec(h.reasonKey),
        transcript: excerpt(h.start, h.end, input.transcript),
        breakdown,
        confidence: clamp(h.score / 95, 0.5, 1),
        source: "ai" as const,
      };
    });
  }
}

export const aiHighlightAnalyzer = new AiHighlightAnalyzer();

export interface AiAnalysisRequest {
  transcript: CaptionLine[];
  envelope: Float32Array;
  hopSec: number;
  duration: number;
  silence: { start: number; end: number }[];
  speech: { start: number; end: number }[];
  energy: { time: number; value: number }[];
  visualEvents?: VisualEvent[];
  clipLength: ClipLength;
  maxResults: number;
  onProgress?: (p: number, stage: string) => void;
}

export async function analyzeWithAi(req: AiAnalysisRequest): Promise<RankedHighlight[]> {
  const input: AiInput = {
    envelope: req.envelope,
    hopSec: req.hopSec,
    duration: req.duration,
    silence: req.silence,
    speech: req.speech,
    energy: req.energy,
    visualEvents: req.visualEvents,
    transcript: req.transcript,
    clipLength: req.clipLength,
    maxResults: req.maxResults,
    onProgress: req.onProgress,
  };
  return aiHighlightAnalyzer.analyze(input);
}
