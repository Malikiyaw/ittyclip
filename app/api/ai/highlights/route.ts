import { NextResponse } from "next/server";
import { buildPrompt, type AiPromptSignals, type AiTranscriptLine } from "@/lib/ai/prompt";
import { validateAiHighlights, type AiHighlightRaw } from "@/lib/ai/validate";
import { CLIP_LENGTHS, type ClipLength } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const PRIMARY_MODEL = process.env.AI_PRIMARY_MODEL ?? "nvidia/llama-3.3-nemotron-super-49b-v1";
const FAST_MODEL = process.env.AI_FAST_MODEL ?? "openai/gpt-oss-120b";
const TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.2);
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS ?? 3500);

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

interface RequestBody {
  transcript: AiTranscriptLine[];
  signals: AiPromptSignals;
  clipLength: ClipLength;
  count: number;
}

async function callNvidia(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  timeoutMs: number,
  temperature = TEMPERATURE,
  jsonMode = true
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: MAX_TOKENS,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Upstream AI returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Upstream AI returned an empty completion.");
    return extractJson(content);
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts the JSON object from a model reply, tolerating prose wrappers. */
function extractJson(content: string): unknown {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("Model reply was not valid JSON.");
  }
}

/** Coerces and validates silence/speech segment lists. */
function sanitizeSegments(v: unknown): { start: number; end: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { start: number; end: number }[] = [];
  for (const s of v) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const start = Number(o.start);
    const end = Number(o.end);
    if (isFinite(start) && isFinite(end) && end > start) out.push({ start, end });
  }
  return out;
}

/** Coerces and validates energy samples. */
function sanitizeEnergy(v: unknown): { time: number; value: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { time: number; value: number }[] = [];
  for (const e of v) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const time = Number(o.time);
    const value = Number(o.value);
    if (isFinite(time) && isFinite(value)) out.push({ time, value });
  }
  return out;
}

export async function POST(req: Request) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI engine is not configured on this deployment (missing NVIDIA_API_KEY)." },
      { status: 503 }
    );
  }

  let body: RequestBody;
  try {
    const raw = (await req.json()) as Partial<RequestBody>;
    if (!Array.isArray(raw.transcript)) throw new Error("transcript must be an array");
    if (!raw.signals || typeof raw.signals !== "object") throw new Error("signals missing");
    if (!CLIP_LENGTHS.includes(raw.clipLength as ClipLength)) throw new Error("invalid clipLength");
    const duration = Number((raw.signals as { duration?: unknown }).duration);
    if (!isFinite(duration) || duration <= 0) throw new Error("invalid duration");
    const count = Math.max(1, Math.min(20, Number(raw.count) || 10));
    const signals = raw.signals as Partial<AiPromptSignals>;
    body = {
      transcript: raw.transcript as AiTranscriptLine[],
      signals: {
        duration,
        silence: sanitizeSegments(signals.silence),
        speech: sanitizeSegments(signals.speech),
        energy: sanitizeEnergy(signals.energy),
      },
      clipLength: raw.clipLength as ClipLength,
      count,
    };
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { system, user } = buildPrompt({
    transcript: body.transcript,
    signals: body.signals,
    clipLength: body.clipLength,
    count: body.count,
  });
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

const models = [PRIMARY_MODEL];
if (FAST_MODEL && FAST_MODEL !== PRIMARY_MODEL) models.push(FAST_MODEL);

// Models occasionally return empty/partial JSON. Each model gets two shots:
// the first with `json_object` mode; the retry drops JSON mode (some models
// return nothing in strict mode) and relies on extractJson instead.
let lastError = "";
for (let i = 0; i < models.length; i++) {
  const model = models[i];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await callNvidia(
        apiKey,
        model,
        messages,
        i === 0 ? 95_000 : 60_000,
        attempt === 0 ? TEMPERATURE : Math.min(0.7, TEMPERATURE + 0.3),
        attempt === 0
      );
      const result = validateAiHighlights(parsed, body.signals.duration);
      if (result.reason) {
        throw new Error(result.reason);
      }
      const highlights: AiHighlightRaw[] = result.highlights.slice(0, body.count);
      return NextResponse.json({ model, highlights, count: highlights.length });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
}

return NextResponse.json(
  {
    error: "AI analysis failed: " + lastError,
    hint: "The local engine is running instead — results may be less tailored.",
  },
  { status: 502 }
);
}
