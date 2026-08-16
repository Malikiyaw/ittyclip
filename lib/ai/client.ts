import type { ClipLength } from "@/lib/types";
import type { AiPromptSignals, AiTranscriptLine } from "@/lib/ai/prompt";
import type { AiHighlightRaw } from "@/lib/ai/validate";
import { aiHeaders, getAiKey } from "@/lib/ai/settings";

export interface AiPayload {
  transcript: AiTranscriptLine[];
  signals: AiPromptSignals;
  clipLength: ClipLength;
  count: number;
}

/**
 * Caps transcript size while preserving temporal coverage.
 * The old implementation sampled every Nth line, which could discard a
 * dense hook/reveal entirely. Keep a time-distributed set of lines instead.
 */
export function trimTranscript(lines: AiTranscriptLine[], maxChars = 14000): AiTranscriptLine[] {
  if (lines.length === 0) return [];
  const total = lines.reduce((n, l) => n + l.text.length, 0);
  if (total <= maxChars) return lines;

  const avgChars = Math.max(1, total / lines.length);
  const targetLines = Math.max(1, Math.min(400, Math.floor(maxChars / avgChars)));
  if (targetLines >= lines.length) return lines;

  const selected: AiTranscriptLine[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < targetLines; i++) {
    const index = Math.min(lines.length - 1, Math.floor((i * (lines.length - 1)) / Math.max(1, targetLines - 1)));
    if (!seen.has(index)) {
      selected.push(lines[index]);
      seen.add(index);
    }
  }

  // If a few unusually long lines pushed us over the budget, trim by adding
  // lines in temporal order until the character budget is reached.
  const out: AiTranscriptLine[] = [];
  let chars = 0;
  for (const line of selected.sort((a, b) => a.start - b.start)) {
    if (chars + line.text.length > maxChars && out.length > 0) continue;
    out.push(line);
    chars += line.text.length;
  }
  return out.slice(0, 400);
}

export interface AiResponse {
  model: string;
  highlights: AiHighlightRaw[];
  count: number;
}

/**
 * Calls the local AI proxy. The API key never leaves the server — the
 * browser only ever talks to `/api/ai/highlights`. A key saved in the
 * browser's AI settings is forwarded so any deployment works with it.
 */
export async function requestAiHighlights(
  payload: AiPayload,
  onStage?: (p: number, stage: string) => void
): Promise<AiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  const attempt = async (): Promise<AiResponse> => {
    const res = await fetch("/api/ai/highlights", {
      method: "POST",
      headers: aiHeaders(),
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
    return { model: data.model ?? "unknown", highlights: data.highlights, count: data.highlights.length };
  };

  try {
    onStage?.(0.3, "AI is reading your transcript…");
    try {
      const result = await attempt();
      onStage?.(0.9, "Formatting results…");
      return result;
    } catch (err) {
      // Transient failures (502/503/504 — including Vercel function timeouts)
      // get one retry when a key is set; the server caches successes, so the
      // retry is usually fast.
      if (err instanceof Error && getAiKey() && /HTTP (502|503|504)/.test(err.message)) {
        await new Promise((r) => setTimeout(r, 1500));
        const result = await attempt();
        onStage?.(0.9, "Formatting results…");
        return result;
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("AI request timed out after 120 seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
