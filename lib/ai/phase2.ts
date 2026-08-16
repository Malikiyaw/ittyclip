import { runAi } from "@/lib/ai/server-client";
import type { AiTranscriptLine, AiPromptSignals } from "@/lib/ai/prompt";

export type Phase2Operation = "insights" | "hooks" | "titles" | "captions" | "trim";

export interface Phase2Context {
  duration: number;
  transcript: AiTranscriptLine[];
  signals?: AiPromptSignals;
  selectedClip?: { start: number; end: number };
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function sanitizeContext(raw: unknown): Phase2Context {
  if (!raw || typeof raw !== "object") throw new Error("context is required");
  const o = raw as Record<string, unknown>;
  const duration = Number(o.duration);
  if (!finite(duration) || duration <= 0 || duration > 24 * 60 * 60) throw new Error("invalid duration");
  const transcript = Array.isArray(o.transcript)
    ? o.transcript.flatMap((x) => {
        if (!x || typeof x !== "object") return [];
        const v = x as Record<string, unknown>;
        const start = Number(v.start); const end = Number(v.end);
        const text = typeof v.text === "string" ? v.text.trim().slice(0, 1000) : "";
        if (!finite(start) || !finite(end) || end <= start || !text) return [];
        return [{ start: Math.max(0, Math.min(duration, start)), end: Math.max(0, Math.min(duration, end)), text }];
      })
    : [];
  const clipRaw = o.selectedClip;
  let selectedClip: Phase2Context["selectedClip"];
  if (clipRaw && typeof clipRaw === "object") {
    const c = clipRaw as Record<string, unknown>;
    const start = Number(c.start); const end = Number(c.end);
    if (finite(start) && finite(end) && end > start) {
      selectedClip = { start: Math.max(0, Math.min(duration, start)), end: Math.max(0, Math.min(duration, end)) };
    }
  }
  return { duration, transcript, selectedClip };
}

function transcriptText(ctx: Phase2Context) {
  return ctx.transcript.slice(0, 2500).map((x) => `[${x.start.toFixed(2)}-${x.end.toFixed(2)}] ${x.text}`).join("\n") || "(no transcript available)";
}

function contextMessage(ctx: Phase2Context) {
  return `VIDEO DURATION: ${ctx.duration.toFixed(2)}s\nSELECTED CLIP: ${ctx.selectedClip ? `${ctx.selectedClip.start.toFixed(2)}-${ctx.selectedClip.end.toFixed(2)}s` : "none"}\nTRANSCRIPT:\n${transcriptText(ctx)}`;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI returned an invalid object");
  return value as Record<string, unknown>;
}

function strings(value: unknown, max: number, maxLen = 240) {
  if (!Array.isArray(value)) throw new Error("AI returned an invalid list");
  return value.filter((x): x is string => typeof x === "string" && x.trim()).slice(0, max).map((x) => x.trim().slice(0, maxLen));
}

export async function runPhase2(operation: Phase2Operation, ctx: Phase2Context, extra = "") {
  const systemBase = "You are IttyClip's production video-editing intelligence. Never invent facts not supported by the supplied transcript or signals. Return JSON only. Keep timestamps within the supplied video duration. Be concise and actionable.";
  const userBase = `${contextMessage(ctx)}\n${extra}`;

  if (operation === "insights") {
    return runAi({
      operation,
      cacheKey: `p2:insights:${JSON.stringify(ctx)}`,
      cacheTtlMs: 30 * 60_000,
      messages: [{ role: "system", content: `${systemBase} Analyze the video's content, pacing and strongest moments.` }, { role: "user", content: `${userBase}\nReturn {"topic":string,"tone":string,"audience":string,"summary":string,"hookStrength":0-100,"pacing":0-100,"clarity":0-100,"bestMoment":{"start":number,"end":number,"reason":string},"suggestions":[string]}.` }],
      validate: (raw) => {
        const o = parseObject(raw); const best = parseObject(o.bestMoment);
        const start = Number(best.start), end = Number(best.end);
        if (!finite(start) || !finite(end) || end <= start || start < 0 || end > ctx.duration) throw new Error("invalid best moment");
        const score = (x: unknown) => Math.max(0, Math.min(100, Math.round(Number(x) || 0)));
        return { topic: String(o.topic ?? "" ).slice(0,120), tone: String(o.tone ?? "").slice(0,120), audience: String(o.audience ?? "").slice(0,160), summary: String(o.summary ?? "").slice(0,500), hookStrength: score(o.hookStrength), pacing: score(o.pacing), clarity: score(o.clarity), bestMoment: { start, end, reason: String(best.reason ?? "").slice(0,240) }, suggestions: strings(o.suggestions, 8) };
      }
    });
  }

  if (operation === "hooks" || operation === "titles") {
    const kind = operation === "hooks" ? "hooks" : "short-form titles";
    return runAi({
      operation,
      cacheKey: `p2:${operation}:${JSON.stringify(ctx)}`,
      cacheTtlMs: 30 * 60_000,
      messages: [{ role: "system", content: `${systemBase} Generate ${kind}. Do not claim something the transcript does not support.` }, { role: "user", content: `${userBase}\nReturn {"items":[string]}. Return exactly 10 useful options when possible.` }],
      validate: (raw) => { const o = parseObject(raw); const items = strings(o.items, 10, 120); if (!items.length) throw new Error("AI returned no options"); return { items }; }
    });
  }

  if (operation === "captions") {
    return runAi({
      operation,
      cacheKey: `p2:captions:${JSON.stringify(ctx)}`,
      cacheTtlMs: 30 * 60_000,
      messages: [{ role: "system", content: `${systemBase} Optimize caption grouping. Preserve every supplied word's meaning. Use short, readable groups and identify emphasis words. Do not invent transcript text.` }, { role: "user", content: `${userBase}\nReturn {"segments":[{"start":number,"end":number,"text":string,"emphasis":[string]}]}. Keep timestamps inside the selected clip when one is supplied.` }],
      validate: (raw) => {
        const o = parseObject(raw); if (!Array.isArray(o.segments)) throw new Error("invalid caption segments");
        const lo = ctx.selectedClip?.start ?? 0, hi = ctx.selectedClip?.end ?? ctx.duration;
        const segments = o.segments.slice(0, 1000).flatMap((x) => {
          if (!x || typeof x !== "object") return [];
          const v = x as Record<string, unknown>; const start = Number(v.start), end = Number(v.end);
          const text = typeof v.text === "string" ? v.text.trim().slice(0, 160) : "";
          if (!finite(start) || !finite(end) || end <= start || start < lo || end > hi || !text) return [];
          return [{ start, end, text, emphasis: strings(v.emphasis, 12, 40) }];
        });
        if (!segments.length) throw new Error("AI returned no valid caption segments");
        return { segments };
      }
    });
  }

  return runAi({
    operation,
    cacheKey: `p2:trim:${JSON.stringify(ctx)}`,
    cacheTtlMs: 10 * 60_000,
    messages: [{ role: "system", content: `${systemBase} Find removable dead air, repetition, weak opening/ending and filler. Return edit suggestions only; never modify the source directly.` }, { role: "user", content: `${userBase}\nReturn {"start":number,"end":number,"cuts":[{"start":number,"end":number,"reason":string}],"reason":string}. The proposed start/end must remain within the selected clip if present.` }],
    validate: (raw) => {
      const o = parseObject(raw); const lo = ctx.selectedClip?.start ?? 0, hi = ctx.selectedClip?.end ?? ctx.duration;
      const start = Number(o.start), end = Number(o.end); if (!finite(start) || !finite(end) || start < lo || end > hi || end <= start) throw new Error("invalid trim range");
      const cuts = Array.isArray(o.cuts) ? o.cuts.slice(0, 30).flatMap((x) => { if (!x || typeof x !== "object") return []; const c=x as Record<string,unknown>; const a=Number(c.start),b=Number(c.end); if(!finite(a)||!finite(b)||a<lo||b>hi||b<=a)return[]; return [{start:a,end:b,reason:String(c.reason??"").slice(0,180)}]; }) : [];
      return { start, end, cuts, reason: String(o.reason ?? "").slice(0,300) };
    }
  });
}
