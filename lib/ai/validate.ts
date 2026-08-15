import type { HighlightReasonKey } from "@/lib/analysis/types";

export interface AiHighlightRaw {
  start: number;
  end: number;
  score: number;
  title: string;
  reasonKey: HighlightReasonKey;
  reason: string;
}

const REASON_KEYS: HighlightReasonKey[] = [
  "energy", "statement", "quote", "question", "surprise",
  "insight", "pacing", "hook", "story", "general",
];

export interface ValidationResult {
  highlights: AiHighlightRaw[];
  reason: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

/**
 * Validates and sanitizes the model's raw output. Never throws on content
 * problems — returns a friendly `reason` so callers can fall back to the
 * local engine instead of crashing the flow.
 */
export function validateAiHighlights(raw: unknown, duration: number): ValidationResult {
  if (!isRecord(raw)) return { highlights: [], reason: "AI returned an unexpected response shape." };
  const list = raw.highlights;
  if (!Array.isArray(list) || list.length === 0) {
    return { highlights: [], reason: "AI returned no highlights." };
  }

  const out: AiHighlightRaw[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const start = typeof item.start === "number" && isFinite(item.start) ? item.start : null;
    const end = typeof item.end === "number" && isFinite(item.end) ? item.end : null;
    if (start === null || end === null || end <= start) continue;
    if (start < 0 || start >= duration) continue;
    if (end - start < 2) continue;

    const score = typeof item.score === "number" && isFinite(item.score)
      ? Math.max(0, Math.min(100, Math.round(item.score)))
      : 50;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 60) : "";
    const reason = typeof item.reason === "string" ? item.reason.trim().slice(0, 140) : "";
    const reasonKey: HighlightReasonKey = REASON_KEYS.includes(item.reasonKey as HighlightReasonKey)
      ? (item.reasonKey as HighlightReasonKey)
      : "general";

    out.push({ start, end, score, title, reason, reasonKey });
  }

  if (out.length === 0) return { highlights: [], reason: "AI returned invalid clip timings." };

  // Drop near-duplicates (temporal IoU), keep highest score first.
  out.sort((a, b) => b.score - a.score);
  const kept: AiHighlightRaw[] = [];
  for (const h of out) {
    const dup = kept.some((k) => {
      const ov = Math.min(k.end, h.end) - Math.max(k.start, h.start);
      const un = Math.max(k.end, h.end) - Math.min(k.start, h.start);
      return un > 0 && ov / un > 0.5;
    });
    if (!dup) kept.push(h);
  }

  return { highlights: kept, reason: null };
}
