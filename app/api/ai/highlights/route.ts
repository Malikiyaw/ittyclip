import { NextResponse } from "next/server";
import { buildPrompt, type AiPromptSignals, type AiTranscriptLine } from "@/lib/ai/prompt";
import { validateAiHighlights, type AiHighlightRaw } from "@/lib/ai/validate";
import { CLIP_LENGTHS, type ClipLength } from "@/lib/types";
import { runAi, AiClientError, readAiRequestConfig } from "@/lib/ai/server-client";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RequestBody {
  transcript: AiTranscriptLine[];
  signals: AiPromptSignals;
  clipLength: ClipLength;
  count: number;
}

function sanitizeSegments(v: unknown, duration: number) {
  if (!Array.isArray(v)) return [];
  return v.flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const o = s as Record<string, unknown>;
    const start = Number(o.start), end = Number(o.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    return [{ start: Math.max(0, Math.min(duration, start)), end: Math.max(0, Math.min(duration, end)) }];
  });
}

function sanitizeEnergy(v: unknown, duration: number) {
  if (!Array.isArray(v)) return [];
  return v.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const o = e as Record<string, unknown>;
    const time = Number(o.time), value = Number(o.value);
    if (!Number.isFinite(time) || !Number.isFinite(value)) return [];
    return [{ time: Math.max(0, Math.min(duration, time)), value: Math.max(0, Math.min(1, value)) }];
  });
}

export async function POST(req: Request) {
  try {
    const raw = await req.json() as Partial<RequestBody>;
    if (!Array.isArray(raw.transcript) || !raw.signals || typeof raw.signals !== "object") {
      return NextResponse.json({ error: "Invalid transcript/signals payload." }, { status: 400 });
    }
    if (!CLIP_LENGTHS.includes(raw.clipLength as ClipLength)) return NextResponse.json({ error: "Invalid clip length." }, { status: 400 });
    const duration = Number((raw.signals as { duration?: unknown }).duration);
    if (!Number.isFinite(duration) || duration <= 0) return NextResponse.json({ error: "Invalid video duration." }, { status: 400 });
    const count = Math.max(1, Math.min(20, Number(raw.count) || 10));
    const signalsRaw = raw.signals as Partial<AiPromptSignals>;
    const transcript = raw.transcript.flatMap((line) => {
      if (!line || typeof line !== "object") return [];
      const start = Number(line.start), end = Number(line.end);
      const text = typeof line.text === "string" ? line.text.trim().slice(0, 1000) : "";
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return [];
      return [{ start: Math.max(0, Math.min(duration, start)), end: Math.max(0, Math.min(duration, end)), text }];
    });
    const signals: AiPromptSignals = {
      duration,
      silence: sanitizeSegments(signalsRaw.silence, duration),
      speech: sanitizeSegments(signalsRaw.speech, duration),
      energy: sanitizeEnergy(signalsRaw.energy, duration),
      visualEvents: Array.isArray(signalsRaw.visualEvents) ? signalsRaw.visualEvents.slice(0, 100) : [],
    };
    const { system, user } = buildPrompt({ transcript, signals, clipLength: raw.clipLength as ClipLength, count });
    const result = await runAi<AiHighlightRaw[]>({
      operation: "highlights",
      ...readAiRequestConfig(req),
      cacheKey: `highlights:${duration}:${raw.clipLength}:${count}:${JSON.stringify(transcript)}:${JSON.stringify(signals)}`,
      cacheTtlMs: 30 * 60_000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      validate: (value) => {
        const checked = validateAiHighlights(value, duration);
        if (checked.reason || !checked.highlights.length) throw new Error(checked.reason ?? "AI returned no valid highlights.");
        return checked.highlights.slice(0, count);
      },
    });
    return NextResponse.json({ model: result.model, highlights: result.value, count: result.value.length, requestId: result.requestId, cached: result.cached });
  } catch (error) {
    if (error instanceof AiClientError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: `AI analysis failed: ${error.message}`, code: error.code, attempts: error.attempts }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI analysis failed." }, { status: 400 });
  }
}
