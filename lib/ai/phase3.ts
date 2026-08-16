import { runAi } from "@/lib/ai/server-client";
import type { AiTranscriptLine } from "@/lib/ai/prompt";
import type { CaptionStyleKey, Word } from "@/lib/types";

export type Phase3Operation = "caption-intelligence" | "caption-style";

export interface Phase3Context {
  duration: number;
  transcript: AiTranscriptLine[];
  selectedClip?: { start: number; end: number };
}

const STYLES: CaptionStyleKey[] = ["classic", "pop", "karaoke", "neon", "minimal", "bold"];

function finite(n: unknown): n is number { return typeof n === "number" && Number.isFinite(n); }
function obj(v: unknown): Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid AI object"); return v as Record<string, unknown>; }
function text(v: unknown, max = 180) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
function strings(v: unknown, max: number) { return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max).map((x) => x.trim().slice(0, 50)) : []; }

export function sanitizePhase3Context(raw: unknown): Phase3Context {
  if (!raw || typeof raw !== "object") throw new Error("context is required");
  const o = raw as Record<string, unknown>;
  const duration = Number(o.duration);
  if (!finite(duration) || duration <= 0 || duration > 86400) throw new Error("invalid duration");
  const transcript = Array.isArray(o.transcript) ? o.transcript.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>;
    const start = Number(x.start); const end = Number(x.end); const value = text(x.text, 1000);
    if (!finite(start) || !finite(end) || end <= start || !value) return [];
    const s = Math.max(0, Math.min(duration, start)); const e = Math.max(0, Math.min(duration, end));
    return e > s ? [{ start: s, end: e, text: value }] : [];
  }).sort((a, b) => a.start - b.start).slice(0, 3000) : [];
  let selectedClip: Phase3Context["selectedClip"];
  if (o.selectedClip && typeof o.selectedClip === "object") {
    const c = o.selectedClip as Record<string, unknown>; const a = Number(c.start); const b = Number(c.end);
    if (finite(a) && finite(b) && b > a) {
      const start = Math.max(0, Math.min(duration, a)); const end = Math.max(0, Math.min(duration, b));
      if (end > start) selectedClip = { start, end };
    }
  }
  return { duration, transcript, selectedClip };
}

function contextText(ctx: Phase3Context) {
  const clip = ctx.selectedClip ? `${ctx.selectedClip.start.toFixed(2)}-${ctx.selectedClip.end.toFixed(2)}s` : "none";
  const transcript = ctx.transcript.slice(0, 1800).map((x) => `[${x.start.toFixed(2)}-${x.end.toFixed(2)}] ${x.text}`).join("\n") || "(no transcript)";
  return `VIDEO: ${ctx.duration.toFixed(2)}s\nSELECTED CLIP: ${clip}\nTRANSCRIPT:\n${transcript}`;
}

function validateSegments(raw: unknown, ctx: Phase3Context) {
  const o = obj(raw); if (!Array.isArray(o.segments)) throw new Error("AI returned invalid caption segments");
  const lo = ctx.selectedClip?.start ?? 0; const hi = ctx.selectedClip?.end ?? ctx.duration;
  const segments = o.segments.slice(0, 1200).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>; const start = Number(x.start); const end = Number(x.end); const value = text(x.text, 180);
    if (!finite(start) || !finite(end) || end <= start || start < lo || end > hi || !value) return [];
    return [{ start, end, text: value, emphasis: strings(x.emphasis, 10) }];
  });
  if (!segments.length) throw new Error("AI returned no valid captions");
  return { segments };
}

export async function runPhase3(operation: Phase3Operation, ctx: Phase3Context) {
  const base = "You are IttyClip's caption intelligence. Use only supplied transcript evidence. Never invent words or timestamps. Return JSON only.";
  if (operation === "caption-intelligence") {
    return runAi({
      operation,
      cacheKey: `p3:caption-intelligence:${JSON.stringify(ctx)}`,
      cacheTtlMs: 30 * 60_000,
      temperature: 0.1,
      maxTokens: 5000,
      messages: [
        { role: "system", content: `${base} Group captions for short-form video. Prefer 2-7 words per screen when possible, keep natural phrases together, avoid orphan words, preserve the supplied wording, and use exact transcript timestamps as the timing source. Return {"segments":[{"start":number,"end":number,"text":string,"emphasis":[string]}]}.` },
        { role: "user", content: contextText(ctx) },
      ],
      validate: (raw) => validateSegments(raw, ctx),
    });
  }
  return runAi({
    operation,
    cacheKey: `p3:caption-style:${JSON.stringify(ctx)}`,
    cacheTtlMs: 30 * 60_000,
    temperature: 0.15,
    maxTokens: 1200,
    messages: [
      { role: "system", content: `${base} Choose exactly one caption style from classic, pop, karaoke, neon, minimal, bold. Recommend based on the actual content and pacing. Also return concise reasons and animation guidance.` },
      { role: "user", content: `${contextText(ctx)}\nReturn {"style":"classic|pop|karaoke|neon|minimal|bold","reason":string,"animation":"none|pop|fade|slide-up|word-pop","emphasisWords":[string]}.` },
    ],
    validate: (raw) => {
      const o = obj(raw); const style = text(o.style, 20) as CaptionStyleKey;
      if (!STYLES.includes(style)) throw new Error("AI returned an invalid caption style");
      const animations = ["none", "pop", "fade", "slide-up", "word-pop"] as const;
      const animation = text(o.animation, 20);
      if (!animations.includes(animation as typeof animations[number])) throw new Error("AI returned an invalid caption animation");
      return { style, reason: text(o.reason, 300), animation: animation as typeof animations[number], emphasisWords: strings(o.emphasisWords, 10) };
    },
  });
}

export function segmentsToWords(segments: { start: number; end: number; text: string }[]): Word[][] {
  return segments.map((segment) => {
    const words = segment.text.split(/\s+/).filter(Boolean);
    const span = Math.max(0.05, segment.end - segment.start);
    return words.map((word, i) => ({ text: word, start: segment.start + span * (i / words.length), end: segment.start + span * ((i + 1) / words.length) }));
  });
}
