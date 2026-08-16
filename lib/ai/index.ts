export { analyzeWithAi, aiHighlightAnalyzer, type AiAnalysisRequest } from "@/lib/ai/provider";
export { requestAiHighlights, trimTranscript, type AiPayload, type AiResponse } from "@/lib/ai/client";
export { buildPrompt, type AiPromptSignals, type AiTranscriptLine } from "@/lib/ai/prompt";
export { validateAiHighlights, type AiHighlightRaw, type ValidationResult } from "@/lib/ai/validate";
export { requestPhase5 } from "@/lib/ai/phase5-client";
export type { Phase5Context, Phase5Operation, AspectKey as Phase5AspectKey } from "@/lib/ai/phase5";
