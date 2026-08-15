export type AspectKey = "9:16" | "1:1" | "4:5" | "16:9";

export interface AspectPreset {
  key: AspectKey;
  ratio: number;
  hint: string;
}

export const ASPECTS: Record<AspectKey, AspectPreset> = {
  "9:16": { key: "9:16", ratio: 9 / 16, hint: "TikTok · Reels · Shorts" },
  "1:1": { key: "1:1", ratio: 1, hint: "Feed posts" },
  "4:5": { key: "4:5", ratio: 4 / 5, hint: "Feed · Facebook" },
  "16:9": { key: "16:9", ratio: 16 / 9, hint: "YouTube · Web" },
};

export interface MediaInfo {
  name: string;
  url: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  mime: string;
}

export interface Moment {
  id: string;
  start: number;
  end: number;
  score: number;
  label: string;
}

export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface CaptionLine {
  id: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export type CaptionStyleKey = "classic" | "pop" | "karaoke" | "neon" | "minimal" | "bold";

export const CAPTION_STYLES: { key: CaptionStyleKey; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "pop", label: "Pop" },
  { key: "karaoke", label: "Karaoke" },
  { key: "neon", label: "Neon" },
  { key: "minimal", label: "Minimal" },
  { key: "bold", label: "Bold Block" },
];

export type CaptionAnimation = "none" | "pop" | "fade" | "slide-up" | "word-pop";

export interface CaptionSettings {
  /** "display" = Archivo Black (matches burned export), "sans" = Inter. */
  font: "display" | "sans";
  /** Font size multiplier. */
  size: number;
  weight: "normal" | "semibold" | "bold" | "black";
  textColor: string;
  highlightColor: string;
  position: "bottom" | "middle" | "top";
  /** Max text width as a fraction of the preview width. */
  maxWidth: number;
  stroke: boolean;
  shadow: boolean;
  background: "none" | "solid" | "soft";
  backgroundOpacity: number;
  lineSpacing: number;
  animation: CaptionAnimation;
  uppercase: boolean;
}

export interface AnalysisResult {
  duration: number;
  envelope: Float32Array;
  /** 50ms hop between envelope samples, seconds. */
  hopSec: number;
  /** Speech segments (inverse of silence). */
  speech: { start: number; end: number }[];
  /** Normalized energy peaks for AI/analysis consumption. */
  energy: { time: number; value: number }[];
  /** Legacy top-6 moment list (kept for compatibility). */
  moments: Moment[];
  silence: { start: number; end: number }[];
}

export type ClipLength = 15 | 30 | 45 | 60;

export const CLIP_LENGTHS: ClipLength[] = [15, 30, 45, 60];

export type ExportFormat = "mp4" | "webm";

export interface ExportJob {
  segments: { start: number; end: number }[];
  captions: CaptionLine[];
  aspect: AspectKey;
  format: ExportFormat;
  resolution: 720 | 1080;
  burnCaptions: boolean;
  watermark: boolean;
  captionSettings?: CaptionSettings;
  reframe?: import("@/lib/reframe/state").ReframeState;
  clipName?: string;
  onProgress: (p: number) => void;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtTime = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

export const fmtClock = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
