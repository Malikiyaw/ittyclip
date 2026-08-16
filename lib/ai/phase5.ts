import { runAi } from "@/lib/ai/server-client";

export type Phase5Operation = "reframe" | "audio" | "scenes" | "preflight";
export type AspectKey = "9:16" | "1:1" | "16:9" | "4:5";

export interface Phase5Context {
  duration: number;
  aspect: AspectKey;
  transcript: { start: number; end: number; text: string }[];
  signals?: {
    speech?: { start: number; end: number; score: number }[];
    energy?: { start: number; end: number; score: number }[];
    silence?: { start: number; end: number; score: number }[];
    visualEvents?: { start: number; end: number; label: string; confidence?: number }[];
  };
  selectedClip?: { start: number; end: number };
}

const ASPECTS: AspectKey[] = ["9:16", "1:1", "16:9", "4:5"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function sanitizePhase5Context(raw: unknown): Phase5Context {
  if (!raw || typeof raw !== "object") throw new Error("context is required");
  const o = raw as Record<string, unknown>;
  const duration = Number(o.duration);
  if (!finite(duration) || duration <= 0 || duration > 86_400) throw new Error("invalid duration");
  const aspect = ASPECTS.includes(o.aspect as AspectKey) ? (o.aspect as AspectKey) : "9:16";
  const transcript = Array.isArray(o.transcript) ? o.transcript.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>;
    const start = clamp(Number(x.start), 0, duration), end = clamp(Number(x.end), 0, duration);
    const text = typeof x.text === "string" ? x.text.trim().slice(0, 500) : "";
    return finite(start) && finite(end) && end > start && text ? [{ start, end, text }] : [];
  }).slice(0, 3000) : [];
  let selectedClip: Phase5Context["selectedClip"];
  if (o.selectedClip && typeof o.selectedClip === "object") {
    const x = o.selectedClip as Record<string, unknown>;
    const start = clamp(Number(x.start), 0, duration), end = clamp(Number(x.end), 0, duration);
    if (finite(start) && finite(end) && end > start) selectedClip = { start, end };
  }

  const rawSignals = o.signals && typeof o.signals === "object" ? o.signals as Record<string, unknown> : {};
  type RangeSignal = { start: number; end: number; score: number };
  type VisualSignal = { start: number; end: number; label: string; confidence: number };

  const numericRanges = (value: unknown): RangeSignal[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): RangeSignal[] => {
      if (!item || typeof item !== "object") return [];
      const x = item as Record<string, unknown>;
      const start = clamp(Number(x.start), 0, duration);
      const end = clamp(Number(x.end), 0, duration);
      const score = x.score === undefined ? 1 : clamp(Number(x.score), 0, 1);
      if (!finite(start) || !finite(end) || !finite(score) || end <= start) return [];
      return [{ start, end, score }];
    }).slice(0, 3000);
  };

  const visualRanges = (value: unknown): VisualSignal[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): VisualSignal[] => {
      if (!item || typeof item !== "object") return [];
      const x = item as Record<string, unknown>;
      const start = clamp(Number(x.start), 0, duration);
      const end = clamp(Number(x.end), 0, duration);
      const confidence = x.confidence === undefined
        ? (x.score === undefined ? 1 : clamp(Number(x.score), 0, 1))
        : clamp(Number(x.confidence), 0, 1);
      const label = typeof x.label === "string" ? x.label.trim().slice(0, 100) : "";
      if (!finite(start) || !finite(end) || !finite(confidence) || end <= start || !label) return [];
      return [{ start, end, label, confidence }];
    }).slice(0, 3000);
  };

  return {
    duration,
    aspect,
    transcript,
    selectedClip,
    signals: {
      speech: numericRanges(rawSignals.speech),
      energy: numericRanges(rawSignals.energy),
      silence: numericRanges(rawSignals.silence),
      visualEvents: visualRanges(rawSignals.visualEvents),
    },
  };
}

function text(ctx: Phase5Context) {
  const transcript = ctx.transcript.slice(0, 1600).map((x) => `[${x.start.toFixed(2)}-${x.end.toFixed(2)}] ${x.text}`).join("\n") || "(no transcript)";
  const visual = (ctx.signals?.visualEvents ?? []).slice(0, 500).map((x) => `[${x.start.toFixed(2)}-${x.end.toFixed(2)}] ${x.label}`).join("\n") || "(none)";
  return `DURATION: ${ctx.duration.toFixed(2)}s\nASPECT: ${ctx.aspect}\nSELECTED CLIP: ${ctx.selectedClip ? `${ctx.selectedClip.start.toFixed(2)}-${ctx.selectedClip.end.toFixed(2)}s` : "none"}\nTRANSCRIPT:\n${transcript}\nVISUAL EVENTS:\n${visual}`;
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI returned an invalid object"); return value as Record<string, unknown>; }
function string(value: unknown, max = 300) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function score(value: unknown) { return clamp(Math.round(Number(value) || 0), 0, 100); }

export async function runPhase5(operation: Phase5Operation, ctx: Phase5Context, extra = "") {
  const system = "You are IttyClip's production video-editing intelligence. Use only supplied evidence. Never invent visual facts, speech, people, events or audio measurements. Return JSON only. Suggestions must be safe, reversible and grounded in the supplied data.";
  const base = `${text(ctx)}\n${extra}`;

  if (operation === "reframe") return runAi({
    operation, cacheKey: `p5:reframe:${JSON.stringify(ctx)}`, cacheTtlMs: 20 * 60_000,
    messages: [{ role: "system", content: `${system} Recommend framing only. Do not claim a subject exists unless visual events support it.` }, { role: "user", content: `${base}\nReturn {"recommendedAspect":"9:16|1:1|16:9|4:5","mode":"tracked|center","focusX":number,"focusY":number,"scale":number,"reason":string,"confidence":0-100}. focusX/focusY are normalized 0..1; scale 1..2.` }],
    validate: (raw) => {
      const o = object(raw); const recommendedAspect = ASPECTS.includes(o.recommendedAspect as AspectKey) ? o.recommendedAspect as AspectKey : ctx.aspect;
      const mode = o.mode === "tracked" ? "tracked" : "center";
      const focusX = clamp(Number(o.focusX), 0, 1), focusY = clamp(Number(o.focusY), 0, 1), scale = clamp(Number(o.scale), 1, 2);
      if (!finite(focusX) || !finite(focusY) || !finite(scale)) throw new Error("invalid reframe recommendation");
      return { recommendedAspect, mode, focusX, focusY, scale, reason: string(o.reason, 300), confidence: score(o.confidence) };
    }
  });

  if (operation === "audio") return runAi({
    operation, cacheKey: `p5:audio:${JSON.stringify(ctx)}`, cacheTtlMs: 15 * 60_000,
    messages: [{ role: "system", content: `${system} Recommend audio processing from speech, silence and energy signals. Do not fabricate measured loudness.` }, { role: "user", content: `${base}\nReturn {"profile":"clean_speech|balanced|music_focused|dialogue|none","noiseReduction":0-100,"speechGainDb":number,"musicGainDb":number,"removeSilence":boolean,"reason":string,"confidence":0-100}. Keep gains between -12 and 12 dB.` }],
    validate: (raw) => {
      const o = object(raw); const profiles = ["clean_speech", "balanced", "music_focused", "dialogue", "none"] as const;
      const profile = profiles.includes(o.profile as typeof profiles[number]) ? o.profile as typeof profiles[number] : "balanced";
      const noiseReduction = score(o.noiseReduction), speechGainDb = clamp(Number(o.speechGainDb) || 0, -12, 12), musicGainDb = clamp(Number(o.musicGainDb) || 0, -12, 12);
      return { profile, noiseReduction, speechGainDb, musicGainDb, removeSilence: typeof o.removeSilence === "boolean" ? o.removeSilence : false, reason: string(o.reason, 300), confidence: score(o.confidence) };
    }
  });

  if (operation === "scenes") return runAi({
    operation, cacheKey: `p5:scenes:${JSON.stringify(ctx)}`, cacheTtlMs: 30 * 60_000,
    messages: [{ role: "system", content: `${system} Classify supplied visual events and transcript windows. Only create scene boundaries supported by supplied events or clear transcript changes.` }, { role: "user", content: `${base}\nReturn {"scenes":[{"start":number,"end":number,"type":"talking_head|gameplay|screen|reaction|conversation|tutorial|broll|unknown","label":string,"confidence":0-100}]}.` }],
    validate: (raw) => {
      const o = object(raw); if (!Array.isArray(o.scenes)) throw new Error("invalid scenes");
      const scenes = o.scenes.slice(0, 200).flatMap((item) => { if (!item || typeof item !== "object") return []; const x=item as Record<string,unknown>; const start=Number(x.start), end=Number(x.end); const types=["talking_head","gameplay","screen","reaction","conversation","tutorial","broll","unknown"] as const; if(!finite(start)||!finite(end)||end<=start||start<0||end>ctx.duration)return[]; const type=types.includes(x.type as typeof types[number])?x.type as typeof types[number]:"unknown"; return [{start,end,type,label:string(x.label,100),confidence:score(x.confidence)}]; });
      return { scenes };
    }
  });

  return runAi({
    operation, cacheKey: `p5:preflight:${JSON.stringify(ctx)}`, cacheTtlMs: 10 * 60_000,
    messages: [{ role: "system", content: `${system} Perform an editor preflight. Distinguish evidence-backed warnings from unavailable checks.` }, { role: "user", content: `${base}\nReturn {"score":0-100,"checks":[{"key":string,"status":"pass|warning|error|unknown","message":string,"fix":"string"}],"autoFixes":[{"key":string,"action":"string","reason":"string"}]}.` }],
    validate: (raw) => {
      const o=object(raw); if(!Array.isArray(o.checks)) throw new Error("invalid preflight checks");
      const checks=o.checks.slice(0,30).flatMap((item)=>{if(!item||typeof item!=="object")return[];const x=item as Record<string,unknown>;const statuses=["pass","warning","error","unknown"] as const;const status=statuses.includes(x.status as typeof statuses[number])?x.status as typeof statuses[number]:"unknown";const key=string(x.key,60);if(!key)return[];return[{key,status,message:string(x.message,240),fix:string(x.fix,240)}];});
      const autoFixes=Array.isArray(o.autoFixes)?o.autoFixes.slice(0,20).flatMap((item)=>{if(!item||typeof item!=="object")return[];const x=item as Record<string,unknown>;const key=string(x.key,60);if(!key)return[];return[{key,action:string(x.action,180),reason:string(x.reason,240)}];}):[];
      return { score: score(o.score), checks, autoFixes };
    }
  });
}
