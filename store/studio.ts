"use client";

import { create } from "zustand";
import { analyzeWithHighlights } from "@/lib/audio";
import { segmentTranscript, makeLines } from "@/lib/captions";
import { presetFor } from "@/lib/captions/presets";
import { runHighlightAnalysis } from "@/lib/analysis/engine";
import { parseProject, serializeProject, type ProjectFile } from "@/lib/project";
import { DEFAULT_REFRAME, type ReframeState } from "@/lib/reframe/state";
import type {
  AnalysisResult,
  CaptionLine,
  CaptionSettings,
  CaptionStyleKey,
  ClipLength,
  ExportFormat,
  MediaInfo,
  Moment,
  AspectKey,
} from "@/lib/types";
import { CLIP_LENGTHS, uid } from "@/lib/types";
import type { HighlightSource, RankedHighlight } from "@/lib/analysis/types";

interface HistoryEntry {
  clips: Moment[];
  captions: CaptionLine[];
  captionStyle: CaptionStyleKey;
  captionSettings: CaptionSettings;
  aspect: AspectKey;
  reframe: ReframeState;
}

interface StudioState {
  media: MediaInfo | null;
  source: File | null;
  analyzing: boolean;
  analyzeProgress: number;
  analyzeStage: string;
  analysis: AnalysisResult | null;
  analysisAbort: AbortController | null;
  pendingHighlights: RankedHighlight[];
  highlightSource: HighlightSource;
  clipLength: ClipLength;
  aiAnalyzing: boolean;
  aiProgress: number;
  aiStage: string;
  aiFailed: boolean;
  clips: Moment[];
  captions: CaptionLine[];
  captionStyle: CaptionStyleKey;
  captionSettings: CaptionSettings;
  showCaptions: boolean;
  showSafeZones: boolean;
  reframe: ReframeState;
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
  pendingProject: ProjectFile | null;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  ingest: (file: File) => Promise<void>;
  cancelAnalysis: () => void;
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
  generateTopClips: () => void;
  clearTimeline: () => void;

  setClipLength: (len: ClipLength) => void;
  rerankHighlights: () => void;
  analyzeWithAI: () => Promise<void>;

  setCaptions: (lines: CaptionLine[]) => void;
  makeCaptionsFromText: (text: string) => void;
  addCaptionAt: () => void;
  updateCaption: (id: string, patch: Partial<CaptionLine>) => void;
  removeCaption: (id: string) => void;
  commitHistory: () => void;

  setCaptionStyle: (s: CaptionStyleKey) => void;
  updateCaptionSettings: (patch: Partial<CaptionSettings>) => void;
  toggleCaptions: () => void;
  toggleSafeZones: () => void;
  setAspect: (a: AspectKey) => void;
  setZoom: (z: number) => void;

  updateReframe: (patch: Partial<ReframeState>) => void;
  commitReframe: () => void;

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
  redo: () => void;
  showToast: (msg: string) => void;
  reset: () => void;
}

const cloneReframe = (r: ReframeState): ReframeState => ({
  ...r,
  track: r.track ? r.track.map((p) => ({ ...p })) : null,
});

const snapshot = (s: StudioState): HistoryEntry => ({
  clips: s.clips.map((c) => ({ ...c })),
  captions: s.captions.map((c) => ({ ...c, words: c.words.map((w) => ({ ...w })) })),
  captionStyle: s.captionStyle,
  captionSettings: { ...s.captionSettings },
  aspect: s.aspect,
  reframe: cloneReframe(s.reframe),
});

const pushHistory = (s: StudioState) => {
  s.undoStack.push(snapshot(s));
  if (s.undoStack.length > 80) s.undoStack.shift();
  s.redoStack = [];
};

const applyHistory = (entry: HistoryEntry): Partial<StudioState> => ({
  clips: entry.clips.map((c) => ({ ...c })),
  captions: entry.captions.map((c) => ({ ...c, words: c.words.map((w) => ({ ...w })) })),
  captionStyle: entry.captionStyle,
  captionSettings: { ...entry.captionSettings },
  aspect: entry.aspect,
  reframe: cloneReframe(entry.reframe),
  activeClipId: null,
});

/** Builds a RankedHighlight from a legacy Moment (pre-engine project restore). */
const legacyRanked = (m: Moment, i: number): RankedHighlight => ({
  ...m,
  rank: i + 1,
  reason: { key: "general", label: "Must-Watch Moment", emoji: "✨" },
  transcript: null,
  breakdown: {
    speech: 0, energy: 0, pacing: 0, silence: 0,
    quotability: 0, completeness: 0, boundary: 0, total: m.score,
  },
  confidence: 0.5,
  source: "local",
});

export const useStudio = create<StudioState>()((set, get) => ({
  media: null,
  source: null,
  analyzing: false,
  analyzeProgress: 0,
  analyzeStage: "",
  analysis: null,
  analysisAbort: null,
  pendingHighlights: [],
  highlightSource: "local",
  clipLength: 30,
  aiAnalyzing: false,
  aiProgress: 0,
  aiStage: "",
  aiFailed: false,
  clips: [],
  captions: [],
  captionStyle: "pop",
  captionSettings: presetFor("pop"),
  showCaptions: true,
  showSafeZones: false,
  reframe: { ...DEFAULT_REFRAME },
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
  pendingProject: null,
  undoStack: [],
  redoStack: [],

  ingest: async (file: File) => {
    const state = get();
    if (state.media?.url) URL.revokeObjectURL(state.media.url);
    if (state.exportResultUrl) URL.revokeObjectURL(state.exportResultUrl);
    state.analysisAbort?.abort();

    const abort = new AbortController();
    set({
      analyzing: true,
      analyzeProgress: 0.02,
      analyzeStage: "Preparing",
      exportState: "idle",
      exportResultUrl: null,
      analysisAbort: abort,
    });

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
    let highlights: RankedHighlight[] = [];
    try {
      const payload = await analyzeWithHighlights(
        file,
        get().clipLength,
        10,
        (p, stage) => set({ analyzeProgress: p, analyzeStage: stage ?? "" }),
        abort.signal
      );
      analysis = payload.analysis;
      highlights = payload.highlights;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        URL.revokeObjectURL(url);
        set({ analyzing: false, analyzeProgress: 0, analyzeStage: "", analysisAbort: null });
        return;
      }
      console.error("[ittyclip] analysis failed:", err);
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

    const legacy = (analysis?.moments ?? []).map(legacyRanked);
    const pool = highlights.length > 0 ? highlights : legacy;

    set({
      media,
      source: file,
      analysis,
      analyzing: false,
      analyzeProgress: 1,
      analyzeStage: "",
      analysisAbort: null,
      pendingHighlights: pool,
      highlightSource: "local",
      clips: pool.slice(0, 3),
      activeClipId: pool[0]?.id ?? null,
      captions: [],
      transcribeStage: "idle",
      transcribeProgress: 0,
      playhead: 0,
      isPlaying: false,
      undoStack: [],
      redoStack: [],
    });

    const pj = get().pendingProject;
    if (pj) {
      const fresh = get();
      pushHistory(fresh);
      set({
        clips: pj.clips,
        captions: pj.captions,
        captionStyle: pj.captionStyle,
        captionSettings: pj.captionSettings,
        aspect: pj.aspect,
        reframe: cloneReframe(pj.reframe),
        clipLength: CLIP_LENGTHS.includes(pj.settings.clipLength) ? pj.settings.clipLength : 30,
        pendingProject: null,
      });
      set({ toast: "Project restored with the original media." });
    }
  },

  cancelAnalysis: () => {
    const abort = get().analysisAbort;
    if (abort) abort.abort();
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
  generateTopClips: () => {
    const s = get();
    if (s.pendingHighlights.length === 0) {
      set({ toast: "No highlights to generate — drop a video first." });
      return;
    }
    pushHistory(s);
    set((st) => {
      const existing = new Set(st.clips.map((c) => c.start.toFixed(3)));
      const fresh = st.pendingHighlights
        .filter((m) => !existing.has(m.start.toFixed(3)))
        .map((m, i) => ({ ...m, id: uid(), label: `Highlight ${m.rank ?? i + 1}` }));
      const clips = [...st.clips, ...fresh].sort((a, b) => a.start - b.start);
      return { clips, activeClipId: fresh[0]?.id ?? st.activeClipId };
    });
    const added = get().clips.length;
    set({ toast: `Generated ${get().pendingHighlights.length} clips — ${added} in timeline` });
  },
  clearTimeline: () => {
    pushHistory(get());
    set({ clips: [], activeClipId: null });
  },

  setClipLength: (len) => {
    if (!CLIP_LENGTHS.includes(len)) return;
    set({ clipLength: len });
    if (get().highlightSource === "ai") {
      set({ toast: `Clip length: ${len}s — AI picks keep their windows` });
      return;
    }
    get().rerankHighlights();
    set({ toast: `Clip length: ${len}s — highlights re-ranked` });
  },

  rerankHighlights: () => {
    const s = get();
    if (!s.analysis) return;
    const pending = runHighlightAnalysis({
      envelope: s.analysis.envelope,
      hopSec: s.analysis.hopSec,
      duration: s.analysis.duration,
      silence: s.analysis.silence,
      transcript: s.captions.length > 0 ? s.captions : null,
      clipLength: s.clipLength,
      maxResults: 10,
    });
    if (pending.length === 0) return;
    set({ pendingHighlights: pending, highlightSource: "local" });
  },

  analyzeWithAI: async () => {
    const s = get();
    if (!s.analysis) {
      set({ toast: "Drop a video first" });
      return;
    }
    if (s.captions.length === 0) {
      set({ toast: "Transcribe the video first — the AI works from the transcript." });
      return;
    }
    if (s.aiAnalyzing) return;
    set({ aiAnalyzing: true, aiProgress: 0.02, aiStage: "Connecting to AI…", aiFailed: false });
    try {
      const { analyzeWithAi } = await import("@/lib/ai");
      const highlights = await analyzeWithAi({
        transcript: s.captions,
        envelope: s.analysis.envelope,
        hopSec: s.analysis.hopSec,
        duration: s.analysis.duration,
        silence: s.analysis.silence,
        speech: s.analysis.speech,
        energy: s.analysis.energy,
        clipLength: s.clipLength,
        maxResults: 10,
        onProgress: (p, stage) => set({ aiProgress: p, aiStage: stage }),
      });
      set({
        pendingHighlights: highlights,
        highlightSource: "ai",
        aiAnalyzing: false,
        aiProgress: 1,
        aiStage: "",
      });
      set({ toast: "AI ranked the best moments for you" });
    } catch (err) {
      console.error("[ittyclip] AI analysis failed:", err);
      set({ aiAnalyzing: false, aiProgress: 0, aiStage: "", aiFailed: true });
      get().rerankHighlights();
      set({ toast: "AI engine unavailable — showing local results instead" });
    }
  },

  setCaptions: (lines) => {
    pushHistory(get());
    set({ captions: lines });
  },
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
  commitHistory: () => pushHistory(get()),

  setCaptionStyle: (s) => {
    pushHistory(get());
    set({
      captionStyle: s,
      captionSettings: presetFor(s),
    });
  },
  updateCaptionSettings: (patch) => {
    set((s) => ({ captionSettings: { ...s.captionSettings, ...patch } }));
  },
  toggleCaptions: () => set((s) => ({ showCaptions: !s.showCaptions })),
  toggleSafeZones: () => set((s) => ({ showSafeZones: !s.showSafeZones })),
  setAspect: (a) => {
    pushHistory(get());
    set({ aspect: a });
  },
  setZoom: (z) => set({ zoom: Math.min(320, Math.max(30, z)) }),

  updateReframe: (patch) => {
    set((s) => ({ reframe: { ...s.reframe, ...patch } }));
  },
  commitReframe: () => pushHistory(get()),

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
      if (get().highlightSource !== "ai") get().rerankHighlights();
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
      serializeProject({
        media: get().media ? { name: get().media!.name, duration: get().media!.duration } : null,
        clips: get().clips,
        captions: get().captions,
        captionStyle: get().captionStyle,
        captionSettings: get().captionSettings,
        aspect: get().aspect,
        reframe: get().reframe,
        clipLength: get().clipLength,
        highlightsSource: get().highlightSource,
      }),
      null,
      2
    ),

  loadProject: (json) => {
    const result = parseProject(json);
    if (!result.ok) {
      set({ toast: result.reason });
      return;
    }
    const pj = result.project;
    pushHistory(get());
    if (get().media) {
      set({
        clips: pj.clips,
        captions: pj.captions,
        captionStyle: pj.captionStyle,
        captionSettings: pj.captionSettings,
        aspect: pj.aspect,
        reframe: cloneReframe(pj.reframe),
        clipLength: CLIP_LENGTHS.includes(pj.settings.clipLength) ? pj.settings.clipLength : 30,
        activeClipId: null,
      });
      set({ toast: "Project loaded." });
    } else {
      set({
        pendingProject: pj,
        toast: "Project loaded — drop the original video to restore it.",
      });
    }
  },

  undo: () => {
    const s = get();
    const entry = s.undoStack.pop();
    if (!entry) {
      set({ toast: "Nothing to undo" });
      return;
    }
    s.redoStack.push(snapshot(s));
    if (s.redoStack.length > 80) s.redoStack.shift();
    set({ ...applyHistory(entry), toast: "Undone" });
  },

  redo: () => {
    const s = get();
    const entry = s.redoStack.pop();
    if (!entry) {
      set({ toast: "Nothing to redo" });
      return;
    }
    s.undoStack.push(snapshot(s));
    if (s.undoStack.length > 80) s.undoStack.shift();
    set({ ...applyHistory(entry), toast: "Redone" });
  },

  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2600);
  },

  reset: () => {
    const s = get();
    if (s.media?.url) URL.revokeObjectURL(s.media.url);
    if (s.exportResultUrl) URL.revokeObjectURL(s.exportResultUrl);
    s.analysisAbort?.abort();
    set({
      media: null,
      source: null,
      analyzing: false,
      analyzeProgress: 0,
      analyzeStage: "",
      analysis: null,
      analysisAbort: null,
      pendingHighlights: [],
      highlightSource: "local",
      clipLength: 30,
      aiAnalyzing: false,
      aiProgress: 0,
      aiStage: "",
      aiFailed: false,
      clips: [],
      captions: [],
      captionStyle: "pop",
      captionSettings: presetFor("pop"),
      showCaptions: true,
      showSafeZones: false,
      reframe: { ...DEFAULT_REFRAME },
      aspect: "9:16",
      playhead: 0,
      isPlaying: false,
      activeClipId: null,
      zoom: 90,
      exportState: "idle",
      exportProgress: 0,
      exportResultUrl: null,
      transcribing: false,
      transcribeProgress: 0,
      transcribeStage: "idle",
      toast: null,
      pendingProject: null,
      undoStack: [],
      redoStack: [],
    });
  },
}));
