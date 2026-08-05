"use client";

import { create } from "zustand";
import { analyzeFile } from "@/lib/audio";
import { segmentTranscript, makeLines } from "@/lib/captions";
import type {
  AnalysisResult,
  CaptionLine,
  CaptionStyleKey,
  ExportFormat,
  MediaInfo,
  Moment,
  AspectKey,
} from "@/lib/types";
import { uid } from "@/lib/types";

interface HistoryEntry {
  clips: Moment[];
  captions: CaptionLine[];
}

interface StudioState {
  media: MediaInfo | null;
  source: File | null;
  analyzing: boolean;
  analyzeProgress: number;
  analysis: AnalysisResult | null;
  pendingHighlights: Moment[];
  clips: Moment[];
  captions: CaptionLine[];
  captionStyle: CaptionStyleKey;
  showCaptions: boolean;
  aspect: AspectKey;
  playhead: number;
  isPlaying: boolean;
  activeClipId: string | null;
  zoom: number;
  exportState: "idle" | "loading" | "running" | "done" | "error";
  exportProgress: number;
  exportResultUrl: string | null;
  exportFormat: ExportFormat;
  transcribing: boolean;
  transcribeProgress: number;
  transcribeStage: "idle" | "model" | "running" | "done" | "error";
  transcribeModel: "tiny.en" | "base.en";
  toast: string | null;
  past: HistoryEntry[];

  ingest: (file: File) => Promise<void>;
  setMedia: (m: MediaInfo) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (b: boolean) => void;
  tick: (t: number) => void;
  addClip: (m: Moment) => void;
  removeClip: (id: string) => void;
  updateClip: (id: string, patch: Partial<Pick<Moment, "start" | "end" | "label">>) => void;
  setActiveClip: (id: string | null) => void;
  addAllHighlights: () => void;
  clearTimeline: () => void;

  setCaptions: (lines: CaptionLine[]) => void;
  makeCaptionsFromText: (text: string) => void;
  addCaptionAt: () => void;
  updateCaption: (id: string, patch: Partial<CaptionLine>) => void;
  removeCaption: (id: string) => void;

  setCaptionStyle: (s: CaptionStyleKey) => void;
  toggleCaptions: () => void;
  setAspect: (a: AspectKey) => void;
  setZoom: (z: number) => void;

  setExportState: (
    s: "idle" | "loading" | "running" | "done" | "error",
    progress?: number,
    url?: string | null
  ) => void;

  setTranscribeModel: (m: "tiny.en" | "base.en") => void;
  transcribe: (model?: "tiny.en" | "base.en") => Promise<void>;

  exportProject: () => string;
  loadProject: (json: string) => void;
  undo: () => void;
  showToast: (msg: string) => void;
  reset: () => void;
}

const pushHistory = (s: StudioState) => {
  s.past.push({ clips: s.clips.map((c) => ({ ...c })), captions: s.captions.map((c) => ({ ...c })) });
  if (s.past.length > 60) s.past.shift();
};

export const useStudio = create<StudioState>()((set, get) => ({
  media: null,
  source: null,
  analyzing: false,
  analyzeProgress: 0,
  analysis: null,
  pendingHighlights: [],
  clips: [],
  captions: [],
  captionStyle: "pop",
  showCaptions: true,
  aspect: "9:16",
  playhead: 0,
  isPlaying: false,
  activeClipId: null,
  zoom: 90,
  exportState: "idle",
  exportProgress: 0,
  exportResultUrl: null,
  exportFormat: "mp4",
  transcribing: false,
  transcribeProgress: 0,
  transcribeStage: "idle",
  transcribeModel: "base.en",
  toast: null,
  past: [],

  ingest: async (file: File) => {
    const state = get();
    if (state.media?.url) URL.revokeObjectURL(state.media.url);
    set({ analyzing: true, analyzeProgress: 0.02, exportState: "idle", exportResultUrl: null });

    const url = URL.createObjectURL(file);
    const dims = await new Promise<{ w: number; h: number; duration: number }>((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () =>
        resolve({ w: v.videoWidth || 1920, h: v.videoHeight || 1080, duration: v.duration || 0 });
      v.onerror = () => resolve({ w: 1920, h: 1080, duration: 0 });
      v.src = url;
    });

    let analysis: AnalysisResult | null = null;
    try {
      analysis = await analyzeFile(file, (p) => set({ analyzeProgress: p }));
    } catch {
      analysis = null;
    }

    const media: MediaInfo = {
      name: file.name,
      url,
      size: file.size,
      duration: analysis?.duration || dims.duration || 0,
      width: dims.w,
      height: dims.h,
      mime: file.type || "video/mp4",
    };

    const pending = analysis?.moments ?? [];

    set({
      media,
      source: file,
      analysis,
      analyzing: false,
      analyzeProgress: 1,
      pendingHighlights: pending,
      clips: pending.slice(0, 3),
      activeClipId: pending[0]?.id ?? null,
      captions: [],
      transcribeStage: "idle",
      transcribeProgress: 0,
      playhead: 0,
      isPlaying: false,
      past: [],
    });
  },

  setMedia: (m) => set({ media: m }),
  setAnalysis: (a) => set({ analysis: a }),
  setPlayhead: (t) => set({ playhead: t }),
  setPlaying: (b) => set({ isPlaying: b }),
  tick: (t) => set({ playhead: t }),

  addClip: (m) => {
    pushHistory(get());
    const copy = { ...m, id: uid() };
    set((s) => ({ clips: [...s.clips, copy].sort((a, b) => a.start - b.start), activeClipId: copy.id }));
  },
  removeClip: (id) => {
    pushHistory(get());
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      activeClipId: s.activeClipId === id ? null : s.activeClipId,
    }));
  },
  updateClip: (id, patch) => {
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },
  setActiveClip: (id) => set({ activeClipId: id }),
  addAllHighlights: () => {
    pushHistory(get());
    set((s) => {
      const existing = new Set(s.clips.map((c) => c.start.toFixed(3)));
      const fresh = s.pendingHighlights
        .filter((m) => !existing.has(m.start.toFixed(3)))
        .map((m) => ({ ...m, id: uid() }));
      return { clips: [...s.clips, ...fresh].sort((a, b) => a.start - b.start) };
    });
  },
  clearTimeline: () => {
    pushHistory(get());
    set({ clips: [], activeClipId: null });
  },

  setCaptions: (lines) => set({ captions: lines }),
  makeCaptionsFromText: (text) => {
    pushHistory(get());
    const s = get();
    if (!s.analysis || s.analysis.silence.length === 0) {
      set({ captions: makeLines(text.split(/\s+/).filter(Boolean), s.media?.duration || 10) });
      return;
    }
    set({ captions: segmentTranscript(text, s.analysis.silence, 9) });
  },
  addCaptionAt: () => {
    pushHistory(get());
    const s = get();
    const start = Math.min(s.playhead, (s.media?.duration ?? 10) - 0.5);
    const line: CaptionLine = { id: uid(), start, end: start + 2.2, text: "New caption", words: [] };
    set((st) => ({ captions: [...st.captions, line].sort((a, b) => a.start - b.start) }));
  },
  updateCaption: (id, patch) => {
    set((s) => ({
      captions: s.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },
  removeCaption: (id) => {
    pushHistory(get());
    set((s) => ({ captions: s.captions.filter((c) => c.id !== id) }));
  },

  setCaptionStyle: (s) => set({ captionStyle: s }),
  toggleCaptions: () => set((s) => ({ showCaptions: !s.showCaptions })),
  setAspect: (a) => set({ aspect: a }),
  setZoom: (z) => set({ zoom: Math.min(320, Math.max(30, z)) }),

  setExportState: (s, progress, url) =>
    set({ exportState: s, exportProgress: progress ?? 0, exportResultUrl: url ?? null }),

  setTranscribeModel: (m) => set({ transcribeModel: m }),

  transcribe: async (model) => {
    const s = get();
    const source = s.source;
    const pick = model ?? s.transcribeModel;
    if (!source) {
      set({ toast: "Upload a video first" });
      return;
    }
    if (s.transcribing) return;
    set({ transcribing: true, transcribeStage: "model", transcribeProgress: 0.01 });

    try {
      const { decodeAudioFile } = await import("@/lib/audio");
      const { ensureModelCached, transcribeCaptions } = await import("@/lib/whisper");
      const buffer = await decodeAudioFile(source);
      await ensureModelCached(pick, (p) => set({ transcribeStage: "model", transcribeProgress: p }));
      const lines = await transcribeCaptions(buffer, pick, (p) =>
        set({ transcribeStage: "running", transcribeProgress: p })
      );
      if (lines.length === 0) {
        set({ transcribing: false, transcribeStage: "error", toast: "No speech detected in this video." });
        return;
      }
      pushHistory(get());
      set({
        captions: lines,
        transcribing: false,
        transcribeStage: "done",
        transcribeProgress: 1,
        toast: `Transcribed ${lines.length} lines (${lines.reduce((n, l) => n + l.words.length, 0)} words)`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        transcribing: false,
        transcribeStage: "error",
        toast: "Transcription failed",
      });
      console.error("[ittyclip] transcription error:", msg);
      throw err;
    }
  },

  exportProject: () =>
    JSON.stringify(
      {
        app: "ittyclip",
        version: 1,
        media: get().media ? { name: get().media!.name, duration: get().media!.duration } : null,
        clips: get().clips,
        captions: get().captions,
        captionStyle: get().captionStyle,
        aspect: get().aspect,
      },
      null,
      2
    ),

  loadProject: (json) => {
    try {
      const data = JSON.parse(json);
      pushHistory(get());
      set({
        clips: Array.isArray(data.clips) ? data.clips : [],
        captions: Array.isArray(data.captions) ? data.captions : [],
        captionStyle: data.captionStyle ?? "pop",
        aspect: data.aspect ?? "9:16",
        activeClipId: null,
        toast: "Project loaded — re-select your video to preview it.",
      });
    } catch {
      set({ toast: "Invalid project file." });
    }
  },

  undo: () => {
    const s = get();
    const last = s.past.pop();
    if (!last) {
      set({ toast: "Nothing to undo" });
      return;
    }
    set({ clips: last.clips, captions: last.captions, toast: "Undone" });
  },

  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2600);
  },

  reset: () => {
    if (get().media?.url) URL.revokeObjectURL(get().media!.url);
    set({
      media: null,
      source: null,
      analyzing: false,
      analyzeProgress: 0,
      analysis: null,
      pendingHighlights: [],
      clips: [],
      captions: [],
      playhead: 0,
      isPlaying: false,
      activeClipId: null,
      zoom: 90,
      exportState: "idle",
      exportProgress: 0,
      exportResultUrl: null,
      toast: null,
      past: [],
    });
  },
}));
