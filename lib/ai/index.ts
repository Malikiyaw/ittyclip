export { analyzeWithAi, aiHighlightAnalyzer, type AiAnalysisRequest } from "@/lib/ai/provider";
export { requestAiHighlights, trimTranscript, type AiPayload, type AiResponse } from "@/lib/ai/client";
export { buildPrompt, type AiPromptSignals, type AiTranscriptLine } from "@/lib/ai/prompt";
export { validateAiHighlights, type AiHighlightRaw, type ValidationResult } from "@/lib/ai/validate";
