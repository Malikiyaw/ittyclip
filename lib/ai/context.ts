import type { ClipLength, VisualEvent } from "@/lib/types";

export interface AiTranscriptLine {
  start: number;
  end: number;
  text: string;
}

export interface AiSegment {
  start: number;
  end: number;
}

export interface AiEnergyPoint {
  time: number;
  value: number;
}

export interface AiContext {
  duration: number;
  transcript: AiTranscriptLine[];
  silence: AiSegment[];
  speech: AiSegment[];
  energy: AiEnergyPoint[];
  visualEvents: VisualEvent[];
  clipLength?: ClipLength;
  count?: number;
  videoId?: string;
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function sanitizeTranscript(value: unknown, duration: number): AiTranscriptLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const start = finiteNumber(row.start);
      const end = finiteNumber(row.end);
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (start === null || end === null || !text || end <= start) return null;
      return {
        start: Math.max(0, Math.min(duration, start)),
        end: Math.max(0, Math.min(duration, end)),
        text: text.slice(0, 1000),
      };
    })
    .filter((x): x is AiTranscriptLine => Boolean(x && x.end > x.start))
    .sort((a, b) => a.start - b.start);
}

export function sanitizeSegments(value: unknown, duration: number, max = 500): AiSegment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const start = finiteNumber(row.start);
      const end = finiteNumber(row.end);
      if (start === null || end === null || end <= start) return null;
      return {
        start: Math.max(0, Math.min(duration, start)),
        end: Math.max(0, Math.min(duration, end)),
      };
    })
    .filter((x): x is AiSegment => Boolean(x && x.end > x.start))
    .sort((a, b) => a.start - b.start)
    .slice(0, max);
}

export function sanitizeEnergy(value: unknown, duration: number, max = 1000): AiEnergyPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const time = finiteNumber(row.time);
      const energy = finiteNumber(row.value);
      if (time === null || energy === null) return null;
      return {
        time: Math.max(0, Math.min(duration, time)),
        value: Math.max(0, Math.min(1, energy)),
      };
    })
    .filter((x): x is AiEnergyPoint => Boolean(x))
    .slice(0, max);
}

export function sanitizeVisualEvents(value: unknown, duration: number, max = 500): VisualEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is VisualEvent => Boolean(item && typeof item === "object"))
    .map((event) => ({ ...event, time: Math.max(0, Math.min(duration, Number(event.time) || 0)) }))
    .filter((event) => Number.isFinite(event.time))
    .slice(0, max);
}

export function buildAiContext(input: Partial<AiContext> & { duration: number }): AiContext {
  const duration = Number(input.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Invalid video duration");
  return {
    duration,
    transcript: sanitizeTranscript(input.transcript, duration),
    silence: sanitizeSegments(input.silence, duration),
    speech: sanitizeSegments(input.speech, duration),
    energy: sanitizeEnergy(input.energy, duration),
    visualEvents: sanitizeVisualEvents(input.visualEvents, duration),
    ...(input.clipLength !== undefined ? { clipLength: input.clipLength } : {}),
    ...(input.count !== undefined ? { count: input.count } : {}),
    ...(input.videoId ? { videoId: input.videoId.slice(0, 200) } : {}),
  };
}
