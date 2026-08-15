import type { AnalysisInput, RankedHighlight } from "@/lib/analysis/types";
import { runHighlightAnalysis } from "@/lib/analysis/engine";

/**
 * Provider interface for highlight analysis (spec §42).
 *
 * `LocalAnalyzer` runs browser heuristics over pre-computed audio signals.
 * An LLM-backed analyzer (`lib/ai/provider.ts`) implements the same
 * interface, so the store and UI never care which engine produced results.
 */
export abstract class HighlightAnalyzerBase {
  abstract readonly name: string;
  abstract analyze(input: AnalysisInput): Promise<RankedHighlight[]>;
}

export class LocalAnalyzer extends HighlightAnalyzerBase {
  readonly name = "local";

  async analyze(input: AnalysisInput): Promise<RankedHighlight[]> {
    return runHighlightAnalysis(input);
  }
}

export const localAnalyzer = new LocalAnalyzer();
