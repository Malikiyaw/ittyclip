import { runAi } from "@/lib/ai/server-client";
import type { CaptionStyleKey, AspectKey } from "@/lib/types";

export type Phase6ActionType = "set_aspect" | "set_caption_style" | "set_zoom" | "trim_active_clip" | "add_clip";

export interface Phase6Context {
  duration: number;
  playhead: number;
  activeClip: { start: number; end: number; label: string } | null;
  clips: { start: number; end: number; label: string }[];
  transcript: { start: number; end: number; text: string }[];
  captionStyle: CaptionStyleKey;
  aspect: AspectKey;
  zoom: number;
}

export interface Phase6Action {
  id: string;
  type: Phase6ActionType;
  title: string;
  reason: string;
  params: Record<string, unknown>;
}

const STYLES: CaptionStyleKey[] = ["classic", "pop", "karaoke", "neon", "minimal", "bold"];
const ASPECTS: AspectKey[] = ["9:16", "1:1", "4:5", "16:9"];

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI returned an invalid object");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 180) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export function sanitizePhase6Context(raw: unknown): Phase6Context {
  if (!raw || typeof raw !== "object") throw new Error("context is required");
  const o = raw as Record<string, unknown>;
  const duration = Number(o.duration);
  if (!finite(duration) || duration <= 0 || duration > 86400) throw new Error("invalid duration");
  const numberInRange = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Number(value); return finite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  const list = (value: unknown, max: number) => Array.isArray(value) ? value.slice(0, max).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>;
    const start = Number(x.start), end = Number(x.end), label = text(x.label, 100), transcript = text(x.text, 500);
    if (!finite(start) || !finite(end) || end <= start) return [];
    const a = Math.max(0, Math.min(duration, start)); const b = Math.max(0, Math.min(duration, end));
    if (b <= a) return [];
    return [{ start: a, end: b, label: label || "Clip", ...(transcript ? { text: transcript } : {}) }];
  }) : [];
  const rawClip = o.activeClip && typeof o.activeClip === "object" ? o.activeClip as Record<string, unknown> : null;
  let activeClip: Phase6Context["activeClip"] = null;
  if (rawClip) {
    const start = Number(rawClip.start), end = Number(rawClip.end);
    if (finite(start) && finite(end) && end > start) activeClip = { start: Math.max(0, Math.min(duration, start)), end: Math.max(0, Math.min(duration, end)), label: text(rawClip.label, 100) || "Active clip" };
    if (activeClip && activeClip.end <= activeClip.start) activeClip = null;
  }
  const captionStyle = STYLES.includes(o.captionStyle as CaptionStyleKey) ? o.captionStyle as CaptionStyleKey : "pop";
  const aspect = ASPECTS.includes(o.aspect as AspectKey) ? o.aspect as AspectKey : "9:16";
  return {
    duration,
    playhead: numberInRange(o.playhead, 0, duration, 0),
    activeClip,
    clips: list(o.clips, 100).map(({ start, end, label }) => ({ start, end, label })),
    transcript: list(o.transcript, 2500).map(({ start, end, text: transcript }) => ({ start, end, text: transcript ?? "" })),
    captionStyle,
    aspect,
    zoom: numberInRange(o.zoom, 10, 200, 90),
  };
}

function validateAction(raw: unknown, ctx: Phase6Context, index: number): Phase6Action | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type as Phase6ActionType;
  if (!["set_aspect", "set_caption_style", "set_zoom", "trim_active_clip", "add_clip"].includes(type)) return null;
  const id = text(o.id, 50) || `action-${index + 1}`;
  const title = text(o.title, 100) || type.replaceAll("_", " ");
  const reason = text(o.reason, 240) || "Suggested by AI from the current project context.";
  let params: Record<string, unknown>;
  if (type === "set_aspect") {
    const aspect = o.aspect as AspectKey;
    if (!ASPECTS.includes(aspect)) return null;
    params = { aspect };
  } else if (type === "set_caption_style") {
    const style = o.style as CaptionStyleKey;
    if (!STYLES.includes(style)) return null;
    params = { style };
  } else if (type === "set_zoom") {
    const zoom = Number(o.zoom);
    if (!finite(zoom) || zoom < 10 || zoom > 200) return null;
    params = { zoom: Math.round(zoom) };
  } else {
    const start = Number(o.start), end = Number(o.end);
    const lo = type === "trim_active_clip" ? ctx.activeClip?.start : 0;
    const hi = type === "trim_active_clip" ? ctx.activeClip?.end : ctx.duration;
    if (!finite(start) || !finite(end) || lo === undefined || hi === undefined || end <= start || start < lo || end > hi) return null;
    if (end - start < 0.05) return null;
    if (type === "add_clip" && ctx.clips.length >= 100) return null;
    params = { start, end, label: text(o.label, 100) || "AI clip" };
  }
  return { id, type, title, reason, params };
}

export async function runPhase6(ctx: Phase6Context, request: string) {
  const cleanRequest = request.trim().slice(0, 1000);
  if (!cleanRequest) throw new Error("Tell Itty what you want changed.");
  const context = `DURATION: ${ctx.duration.toFixed(2)}s\nPLAYHEAD: ${ctx.playhead.toFixed(2)}s\nACTIVE CLIP: ${ctx.activeClip ? `${ctx.activeClip.start.toFixed(2)}-${ctx.activeClip.end.toFixed(2)}s (${ctx.activeClip.label})` : "none"}\nCURRENT ASPECT: ${ctx.aspect}\nCURRENT CAPTION STYLE: ${ctx.captionStyle}\nCURRENT ZOOM: ${ctx.zoom}\nTRANSCRIPT:\n${ctx.transcript.slice(0, 2500).map((x) => `[${x.start.toFixed(2)}-${x.end.toFixed(2)}] ${x.text}`).join("\n") || "(none)"}`;
  return runAi({
    operation: "phase6_assistant",
    cacheKey: `p6:${JSON.stringify(ctx)}:${cleanRequest.toLowerCase()}`,
    cacheTtlMs: 10 * 60_000,
    temperature: 0.15,
    maxTokens: 3000,
    messages: [
      { role: "system", content: "You are IttyClip's editing assistant. Convert the user's request into a small, safe, reviewable edit plan. Never invent video facts. Only use these actions: set_aspect, set_caption_style, set_zoom, trim_active_clip, add_clip. Do not output actions that delete data, publish content, call external services, or modify files. If the request cannot be safely represented, return an empty actions array and explain. Return JSON only: {summary:string, actions:[{id,type,title,reason,params}]}" },
      { role: "user", content: `${context}\n\nUSER REQUEST:\n${cleanRequest}\n\nPrefer the minimum number of actions needed. A trim_active_clip requires an active clip. Keep all timestamps inside valid bounds.` }
    ],
    validate: (raw) => {
      const o = object(raw);
      const rawActions = Array.isArray(o.actions) ? o.actions : [];
      const actions = rawActions.slice(0, 8).map((x, i) => validateAction(x, ctx, i)).filter((x): x is Phase6Action => x !== null);
      const summary = text(o.summary, 500) || (actions.length ? "I created a reviewable edit plan." : "I couldn't create a safe edit plan from that request.");
      return { summary, actions };
    }
  });
}
