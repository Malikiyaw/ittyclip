import { runAi } from "@/lib/ai/server-client";

export type Phase4Operation = "hooks" | "titles" | "description" | "hashtags" | "platform";
export type Phase4Platform = "tiktok" | "youtube" | "instagram";

export interface Phase4Context {
  duration: number;
  transcript: { start: number; end: number; text: string }[];
  selectedClip?: { start: number; end: number };
}

function finite(n: unknown): n is number { return typeof n === "number" && Number.isFinite(n); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI returned an invalid object");
  return value as Record<string, unknown>;
}
function strings(value: unknown, max: number, maxLen: number): string[] {
  if (!Array.isArray(value)) throw new Error("AI returned an invalid list");
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max).map((x) => x.trim().slice(0, maxLen));
}
function cleanContext(raw: unknown): Phase4Context {
  if (!raw || typeof raw !== "object") throw new Error("context is required");
  const o = raw as Record<string, unknown>;
  const duration = Number(o.duration);
  if (!finite(duration) || duration <= 0 || duration > 86400) throw new Error("invalid duration");
  const transcript = Array.isArray(o.transcript) ? o.transcript.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>;
    const start = Math.max(0, Math.min(duration, Number(x.start)));
    const end = Math.max(0, Math.min(duration, Number(x.end)));
    const text = typeof x.text === "string" ? x.text.trim().slice(0, 1000) : "";
    return finite(start) && finite(end) && end > start && text ? [{ start, end, text }] : [];
  }) : [];
  const clip = o.selectedClip;
  let selectedClip: Phase4Context["selectedClip"];
  if (clip && typeof clip === "object") {
    const c = clip as Record<string, unknown>;
    const start = Math.max(0, Math.min(duration, Number(c.start)));
    const end = Math.max(0, Math.min(duration, Number(c.end)));
    if (finite(start) && finite(end) && end > start) selectedClip = { start, end };
  }
  return { duration, transcript, selectedClip };
}

function transcript(ctx: Phase4Context) {
  return ctx.transcript.slice(0, 2500).map((x) => `[${x.start.toFixed(2)}-${x.end.toFixed(2)}] ${x.text}`).join("\n") || "(no transcript available)";
}

export function sanitizePhase4Context(raw: unknown) { return cleanContext(raw); }

export async function runPhase4(operation: Phase4Operation, ctx: Phase4Context, platform: Phase4Platform = "tiktok") {
  const base = `VIDEO DURATION: ${ctx.duration.toFixed(2)}s\nSELECTED CLIP: ${ctx.selectedClip ? `${ctx.selectedClip.start.toFixed(2)}-${ctx.selectedClip.end.toFixed(2)}s` : "none"}\nTRANSCRIPT:\n${transcript(ctx)}`;
  const system = "You are IttyClip's short-form content strategist. Use only facts supported by the transcript. Never invent people, claims, statistics, events, products, or quotes. Return JSON only. Avoid spammy keyword stuffing and misleading claims.";
  if (operation === "hooks" || operation === "titles") {
    const key = operation === "hooks" ? "hooks" : "titles";
    return runAi({ operation: `phase4:${operation}`, cacheKey: `p4:${operation}:${JSON.stringify(ctx)}`, cacheTtlMs: 30 * 60_000, messages: [
      { role: "system", content: `${system} Generate strong ${key} for a short-form video. Keep them natural, specific and concise.` },
      { role: "user", content: `${base}\nReturn {"items":[string]}. Return 10 distinct options, each under 120 characters.` },
    ], validate: (raw) => {
      const items = strings(object(raw).items, 10, 120);
      if (!items.length) throw new Error("AI returned no options");
      return { items };
    } });
  }
  if (operation === "description") {
    return runAi({ operation: "phase4:description", cacheKey: `p4:description:${JSON.stringify(ctx)}`, cacheTtlMs: 30 * 60_000, messages: [
      { role: "system", content: `${system} Write a concise platform-ready description. Do not add unsupported facts.` },
      { role: "user", content: `${base}\nReturn {"description":string,"keywords":[string]}. Description must be under 800 characters.` },
    ], validate: (raw) => {
      const o = object(raw); const description = typeof o.description === "string" ? o.description.trim().slice(0, 800) : "";
      if (!description) throw new Error("AI returned an empty description");
      return { description, keywords: strings(o.keywords, 12, 40) };
    } });
  }
  if (operation === "hashtags") {
    return runAi({ operation: "phase4:hashtags", cacheKey: `p4:hashtags:${JSON.stringify(ctx)}:${platform}`, cacheTtlMs: 30 * 60_000, messages: [
      { role: "system", content: `${system} Generate relevant hashtags for ${platform}. Prefer a small mix of specific and broad tags. Do not use unrelated trending tags.` },
      { role: "user", content: `${base}\nReturn {"hashtags":[string]}. Return 8-15 hashtags without the # symbol.` },
    ], validate: (raw) => {
      const hashtags = strings(object(raw).hashtags, 15, 40).map((x) => x.replace(/^#+/, "").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40)).filter(Boolean);
      if (!hashtags.length) throw new Error("AI returned no hashtags");
      return { hashtags: [...new Set(hashtags)].slice(0, 15) };
    } });
  }
  return runAi({ operation: "phase4:platform", cacheKey: `p4:platform:${platform}:${JSON.stringify(ctx)}`, cacheTtlMs: 30 * 60_000, messages: [
    { role: "system", content: `${system} Create a platform-specific content pack for ${platform}. Optimize wording and length for the platform without promising reach or inventing facts.` },
    { role: "user", content: `${base}\nReturn {"hook":string,"title":string,"description":string,"hashtags":[string],"cta":string}. Keep hook/title under 120 chars, description under 800 chars, CTA under 100 chars.` },
  ], validate: (raw) => {
    const o = object(raw); const text = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
    const value = { hook: text(o.hook, 120), title: text(o.title, 120), description: text(o.description, 800), hashtags: strings(o.hashtags, 15, 40).map((x) => x.replace(/^#+/, "").replace(/[^\p{L}\p{N}_-]/gu, "")).filter(Boolean), cta: text(o.cta, 100) };
    if (!value.hook || !value.title || !value.description) throw new Error("AI returned an incomplete platform pack");
    value.hashtags = [...new Set(value.hashtags)].slice(0, 15);
    return value;
  } });
}
