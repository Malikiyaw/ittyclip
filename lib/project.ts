import type { AspectKey, CaptionLine, CaptionSettings, CaptionStyleKey, ClipLength, Moment } from "@/lib/types";
import { CLIP_LENGTHS } from "@/lib/types";
import type { ReframeState } from "@/lib/reframe/state";
import { DEFAULT_REFRAME } from "@/lib/reframe/state";
import { DEFAULT_CAPTION_SETTINGS } from "@/lib/captions/presets";

export const PROJECT_VERSION = 2;
export const PROJECT_EXT = ".ittyclip";

export interface ProjectFile {
  app: "ittyclip";
  version: number;
  project: { name: string; createdAt: string };
  media: { name: string; duration: number } | null;
  clips: Moment[];
  captions: CaptionLine[];
  captionStyle: CaptionStyleKey;
  captionSettings: CaptionSettings;
  aspect: AspectKey;
  reframe: ReframeState;
  settings: { clipLength: ClipLength };
  metadata: { highlightsSource?: "ai" | "local" };
}

const STYLES: CaptionStyleKey[] = ["classic", "pop", "karaoke", "neon", "minimal", "bold"];
const ASPECTS: AspectKey[] = ["9:16", "1:1", "4:5", "16:9"];

function cleanClip(c: unknown): Moment | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const start = typeof o.start === "number" && isFinite(o.start) ? Math.max(0, o.start) : null;
  const end = typeof o.end === "number" && isFinite(o.end) ? o.end : null;
  if (start === null || end === null || end <= start) return null;
  return {
    id: typeof o.id === "string" && o.id ? o.id : `c${Math.random().toString(36).slice(2, 8)}`,
    start,
    end,
    score: typeof o.score === "number" && isFinite(o.score) ? Math.max(0, Math.min(100, Math.round(o.score))) : 50,
    label: typeof o.label === "string" ? o.label : "Clip",
  };
}

function cleanCaption(c: unknown): CaptionLine | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const start = typeof o.start === "number" && isFinite(o.start) ? Math.max(0, o.start) : null;
  const end = typeof o.end === "number" && isFinite(o.end) ? o.end : null;
  if (start === null || end === null || end <= start) return null;
  const text = typeof o.text === "string" ? o.text : "";
  if (!text.trim()) return null;
  const words = Array.isArray(o.words)
    ? (o.words as unknown[])
        .filter(
          (w): w is { text: unknown; start: unknown; end: unknown } =>
            !!w && typeof w === "object"
        )
        .map((w) => ({
          text: typeof w.text === "string" ? w.text : "",
          start: typeof w.start === "number" ? w.start : 0,
          end: typeof w.end === "number" ? w.end : 0,
        }))
        .filter((w) => w.text !== "")
    : [];
  return { id: typeof o.id === "string" && o.id ? o.id : `l${Math.random().toString(36).slice(2, 8)}`, start, end, text, words };
}

function cleanReframe(r: unknown): ReframeState {
  const base = { ...DEFAULT_REFRAME };
  if (!r || typeof r !== "object") return base;
  const o = r as Record<string, unknown>;
  const out: ReframeState = {
    enabled: o.enabled === true,
    mode: o.mode === "tracked" ? "tracked" : "center",
    offsetX: typeof o.offsetX === "number" && isFinite(o.offsetX) ? Math.max(-1, Math.min(1, o.offsetX)) : 0,
    offsetY: typeof o.offsetY === "number" && isFinite(o.offsetY) ? Math.max(-1, Math.min(1, o.offsetY)) : 0,
    scale: typeof o.scale === "number" && isFinite(o.scale) ? Math.max(1, Math.min(2, o.scale)) : 1,
    track: null,
    status: "idle",
  };
  if (Array.isArray(o.track)) {
    const track = (o.track as unknown[])
      .filter((p): p is { t: unknown; x: unknown; y: unknown; w: unknown; h: unknown } => !!p && typeof p === "object")
      .map((p) => ({
        t: typeof p.t === "number" && isFinite(p.t) ? Math.max(0, p.t) : 0,
        x: typeof p.x === "number" && isFinite(p.x) ? Math.max(0, Math.min(1, p.x)) : 0.5,
        y: typeof p.y === "number" && isFinite(p.y) ? Math.max(0, Math.min(1, p.y)) : 0.5,
        w: typeof p.w === "number" && isFinite(p.w) ? Math.max(0.01, Math.min(1, p.w)) : 0.3,
        h: typeof p.h === "number" && isFinite(p.h) ? Math.max(0.01, Math.min(1, p.h)) : 0.3,
      }));
    if (track.length >= 2) {
      out.track = track;
      out.status = "done";
    }
  }
  return out;
}

export type ParseResult = { ok: true; project: ProjectFile } | { ok: false; reason: string };

export interface ProjectStateInput {
  media: { name: string; duration: number } | null;
  clips: Moment[];
  captions: CaptionLine[];
  captionStyle: CaptionStyleKey;
  captionSettings: CaptionSettings;
  aspect: AspectKey;
  reframe: ReframeState;
  clipLength: ClipLength;
  highlightsSource?: "ai" | "local";
  name?: string;
}

/** Builds a versioned project object from editor state. */
export function serializeProject(input: ProjectStateInput): ProjectFile {
  return {
    app: "ittyclip",
    version: PROJECT_VERSION,
    project: {
      name: input.name ?? "Untitled project",
      createdAt: new Date().toISOString(),
    },
    media: input.media
      ? { name: input.media.name, duration: input.media.duration }
      : null,
    clips: input.clips.map((c) => ({ ...c })),
    captions: input.captions.map((c) => ({ ...c, words: c.words.map((w) => ({ ...w })) })),
    captionStyle: input.captionStyle,
    captionSettings: { ...input.captionSettings },
    aspect: input.aspect,
    reframe: {
      ...input.reframe,
      track: input.reframe.track ? input.reframe.track.map((p) => ({ ...p })) : null,
    },
    settings: { clipLength: CLIP_LENGTHS.includes(input.clipLength) ? input.clipLength : 30 },
    metadata: { highlightsSource: input.highlightsSource },
  };
}

/**
 * Parses and validates a project file. Supports v1 files via migration.
 * Returns a friendly reason instead of throwing so callers can show it
 * directly to the user (spec: no raw stack traces in the UI).
 */
export function parseProject(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, reason: "This file is not valid JSON — it may be corrupted or not an ittyclip project." };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "This file does not look like an ittyclip project." };
  }
  const o = raw as Record<string, unknown>;

  if (o.app !== "ittyclip") {
    return { ok: false, reason: "This file was not created by ittyclip." };
  }

  const version = typeof o.version === "number" ? o.version : 0;
  if (version !== 1 && version !== 2) {
    return { ok: false, reason: `Unsupported project version (${version}). This app supports v1 and v2.` };
  }

  const clips = Array.isArray(o.clips) ? o.clips.map(cleanClip).filter((c): c is Moment => c !== null) : [];
  const captions = Array.isArray(o.captions) ? o.captions.map(cleanCaption).filter((c): c is CaptionLine => c !== null) : [];

  const media =
    o.media && typeof o.media === "object"
      ? {
          name: typeof (o.media as Record<string, unknown>).name === "string" ? (o.media as Record<string, unknown>).name as string : "video",
          duration: typeof (o.media as Record<string, unknown>).duration === "number" ? (o.media as Record<string, unknown>).duration as number : 0,
        }
      : null;

  const captionStyle: CaptionStyleKey = STYLES.includes(o.captionStyle as CaptionStyleKey)
    ? (o.captionStyle as CaptionStyleKey)
    : "pop";
  const aspect: AspectKey = ASPECTS.includes(o.aspect as AspectKey) ? (o.aspect as AspectKey) : "9:16";

  const settingsRaw =
    o.settings && typeof o.settings === "object" ? (o.settings as Record<string, unknown>) : null;
  const clipRaw = settingsRaw ? settingsRaw.clipLength : undefined;
  const clipLength: ClipLength =
    typeof clipRaw === "number" && CLIP_LENGTHS.includes(clipRaw as ClipLength)
      ? (clipRaw as ClipLength)
      : 30;

  const captionSettingsRaw =
    o.captionSettings && typeof o.captionSettings === "object"
      ? (o.captionSettings as Record<string, unknown>)
      : null;
  const captionSettings: CaptionSettings = {
    ...DEFAULT_CAPTION_SETTINGS,
    ...(captionSettingsRaw ? sanitizeCaptionSettings(captionSettingsRaw) : {}),
  };

  const reframe = cleanReframe(o.reframe);

  const project: ProjectFile = {
    app: "ittyclip",
    version: PROJECT_VERSION,
    project: {
      name: o.project && typeof o.project === "object" && typeof (o.project as Record<string, unknown>).name === "string"
        ? ((o.project as Record<string, unknown>).name as string)
        : "Untitled project",
      createdAt: o.project && typeof o.project === "object" && typeof (o.project as Record<string, unknown>).createdAt === "string"
        ? ((o.project as Record<string, unknown>).createdAt as string)
        : new Date().toISOString(),
    },
    media,
    clips,
    captions,
    captionStyle,
    captionSettings,
    aspect,
    reframe,
    settings: { clipLength },
    metadata: {
      highlightsSource: (o.metadata && (o.metadata as Record<string, unknown>).highlightsSource === "ai" ? "ai" : "local") as "ai" | "local",
    },
  };
  return { ok: true, project };
}

function sanitizeCaptionSettings(o: Record<string, unknown>): Partial<CaptionSettings> {
  const out: Partial<CaptionSettings> = {};
  if (o.font === "display" || o.font === "sans") out.font = o.font;
  if (typeof o.size === "number" && isFinite(o.size)) out.size = Math.max(0.6, Math.min(2, o.size));
  if (["normal", "semibold", "bold", "black"].includes(o.weight as string)) out.weight = o.weight as CaptionSettings["weight"];
  if (typeof o.textColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(o.textColor)) out.textColor = o.textColor;
  if (typeof o.highlightColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(o.highlightColor)) out.highlightColor = o.highlightColor;
  if (["bottom", "middle", "top"].includes(o.position as string)) out.position = o.position as CaptionSettings["position"];
  if (typeof o.maxWidth === "number" && isFinite(o.maxWidth)) out.maxWidth = Math.max(0.4, Math.min(1, o.maxWidth));
  if (typeof o.stroke === "boolean") out.stroke = o.stroke;
  if (typeof o.shadow === "boolean") out.shadow = o.shadow;
  if (["none", "solid", "soft"].includes(o.background as string)) out.background = o.background as CaptionSettings["background"];
  if (typeof o.backgroundOpacity === "number" && isFinite(o.backgroundOpacity)) out.backgroundOpacity = Math.max(0, Math.min(1, o.backgroundOpacity));
  if (typeof o.lineSpacing === "number" && isFinite(o.lineSpacing)) out.lineSpacing = Math.max(0.8, Math.min(1.8, o.lineSpacing));
  if (["none", "pop", "fade", "slide-up", "word-pop"].includes(o.animation as string)) out.animation = o.animation as CaptionSettings["animation"];
  if (typeof o.uppercase === "boolean") out.uppercase = o.uppercase;
  return out;
}
