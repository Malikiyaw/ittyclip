import type { ClipLength } from "@/lib/types";
import type { AiPromptSignals, AiTranscriptLine } from "@/lib/ai/prompt";
import type { AiHighlightRaw } from "@/lib/ai/validate";

export interface AiPayload {
  transcript: AiTranscriptLine[];
  signals: AiPromptSignals;
  clipLength: ClipLength;
  count: number;
}

/** Caps transcript size for the model while preserving even coverage. */
export function trimTranscript(lines: AiTranscriptLine[], maxChars = 14000): AiTranscriptLine[] {
  const total = lines.reduce((n, l) => n + l.text.length, 0);
  if (total <= maxChars) return lines;
  const ratio = maxChars / total;
  const step = Math.max(1, Math.round(1 / ratio));
  return lines.filter((_, i) => i % step === 0).slice(0, 400);
}

export interface AiResponse {
  model: string;
  highlights: AiHighlightRaw[];
  count: number;
}

/**
 * Calls the local AI proxy. The API key never leaves the server — the
 * browser only ever talks to `/api/ai/highlights`.
 */
export async function requestAiHighlights(
  payload: AiPayload,
  onStage?: (p: number, stage: string) => void
): Promise<AiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    onStage?.(0.3, "AI is reading your transcript…");
    const res = await fetch("/api/ai/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as
      | { highlights?: AiHighlightRaw[]; error?: string; model?: string }
      | null;

    if (!res.ok) {
      throw new Error(data?.error ?? `AI request failed (HTTP ${res.status}).`);
    }
    if (!data || !Array.isArray(data.highlights)) {
      throw new Error("AI returned an unreadable response.");
    }
    onStage?.(0.9, "Formatting results…");
    return { model: data.model ?? "unknown", highlights: data.highlights, count: data.highlights.length };
  } finally {
    clearTimeout(timer);
  }
}
