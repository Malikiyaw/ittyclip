import type { AnalysisResult, ClipLength, Moment } from "@/lib/types";
import { runHighlightAnalysis } from "@/lib/analysis/engine";
import type { RankedHighlight } from "@/lib/analysis/types";
import { analyzeVisualEvents } from "@/lib/analysis/visual";
import {
  ANALYSIS_STAGES, HOP_MS, computeEnvelope, detectEnergyPeaks, detectMoments,
  detectSilence, detectSpeech, waveformPeaks,
} from "@/lib/analysis/extract";

export { ANALYSIS_STAGES, HOP_MS, computeEnvelope, detectEnergyPeaks, detectMoments, detectSilence, detectSpeech, waveformPeaks } from "@/lib/analysis/extract";
export type { AnalysisProgress } from "@/lib/analysis/extract";

/** Maximum file size for full local signal analysis. This is intentionally
 * conservative because mobile browsers can hold several copies of a decoded
 * audio buffer at once and iOS may terminate the tab instead of throwing. */
export const MAX_LOCAL_ANALYSIS_BYTES = 250 * 1024 * 1024;

function assertSafeForLocalAnalysis(file: Blob) {
  if (file.size > MAX_LOCAL_ANALYSIS_BYTES) {
    throw new Error(`This video is ${(file.size / 1024 / 1024).toFixed(0)} MB. For reliable mobile performance, automatic analysis is limited to 250 MB. You can still edit the video manually.`);
  }
}

function decodeAudio(file: Blob, signal?: AbortSignal): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    try { assertSafeForLocalAnalysis(file); } catch (err) { reject(err); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) { reject(new Error("Web Audio is unavailable in this browser.")); return; }
    const ctx = new Ctx();
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const close = () => { if (timeout) clearTimeout(timeout); ctx.close().catch(() => {}); };
    const fail = (err: unknown) => { if (settled) return; settled = true; close(); reject(err instanceof Error ? err : new Error(String(err))); };
    const onAbort = () => fail(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(() => fail(new Error("Audio decoding timed out. Try a shorter video or a different format.")), 120_000);
    file.arrayBuffer().then((buf) => {
      if (signal?.aborted) return onAbort();
      try {
        ctx.decodeAudioData(buf, (audio) => {
          if (settled) return; settled = true; close(); signal?.removeEventListener("abort", onAbort); resolve(audio);
        }, (err) => fail(new Error("Could not decode audio track: " + (err?.message || "unknown decode error"))));
      } catch (err) { fail(err); }
    }).catch(fail);
  });
}

export function decodeAudioFile(file: Blob, signal?: AbortSignal): Promise<AudioBuffer> { return decodeAudio(file, signal); }

export async function analyzeFileMain(file: File, onProgress?: (p: number, stage?: string) => void, signal?: AbortSignal): Promise<AnalysisResult> {
  assertSafeForLocalAnalysis(file);
  const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const emit = (idx: number) => { if (signal?.aborted) throw new DOMException("Aborted", "AbortError"); onProgress?.(...(ANALYSIS_STAGES[Math.min(idx, ANALYSIS_STAGES.length - 1)])); };
  emit(0); await yieldToMain();
  const buffer = await decodeAudio(file, signal); emit(1); await yieldToMain();
  const env = await computeEnvelope(buffer, () => {}, 4096); emit(2); await yieldToMain();
  const duration = buffer.duration;
  const silence = detectSilence(env, duration, HOP_MS); await yieldToMain();
  const speech = detectSpeech(env, duration, HOP_MS); emit(3); await yieldToMain();
  const energy = detectEnergyPeaks(env, HOP_MS, duration); emit(4); await yieldToMain();
  const moments = detectMoments(env, duration, HOP_MS); emit(5); await yieldToMain(); emit(6); await yieldToMain(); emit(7);
  return { duration, envelope: env, speech, energy, moments, silence, hopSec: HOP_MS / 1000 };
}

interface AnalyzeWorkerResult {
  duration: number; envelope: Float32Array; hopSec: number;
  speech: { start: number; end: number }[]; energy: { time: number; value: number }[];
  moments: Moment[]; silence: { start: number; end: number }[]; highlights: RankedHighlight[];
}
interface AnalyzePayload { analysis: AnalysisResult; highlights: RankedHighlight[]; }

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (payload: AnalyzePayload) => void; reject: (err: Error) => void }>();

function getAnalyzeWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./analyze.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type: string; id: number; result?: AnalyzeWorkerResult; message?: string };
    const entry = pending.get(msg.id); if (!entry) return;
    if (msg.type === "result" && msg.result) {
      pending.delete(msg.id); const { highlights, envelope, ...rest } = msg.result;
      entry.resolve({ analysis: { ...rest, envelope }, highlights });
    } else if (msg.type === "error") {
      pending.delete(msg.id); try { worker?.terminate(); } catch {} worker = null; entry.reject(new Error(msg.message || "Analysis worker error"));
    }
  };
  worker.onerror = () => {
    const entries = Array.from(pending.values()); pending.clear(); try { worker?.terminate(); } catch {} worker = null;
    for (const entry of entries) entry.reject(new Error("Analysis worker crashed"));
  };
  return worker;
}

function analyzeWithWorker(file: File, clipLength: ClipLength, maxResults: number, onProgress?: (p: number, stage?: string) => void, signal?: AbortSignal): Promise<AnalyzePayload> {
  const w = getAnalyzeWorker(), id = ++seq;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      pending.delete(id); try { w.postMessage({ type: "cancel", id }); } catch {} try { w.terminate(); } catch {}
      if (worker === w) worker = null; cleanup(); reject(new DOMException("Aborted", "AbortError"));
    };
    pending.set(id, { resolve: (payload) => { cleanup(); resolve(payload); }, reject: (err) => { cleanup(); reject(err); } });
    signal?.addEventListener("abort", onAbort, { once: true });
    try { w.postMessage({ type: "analyze", id, file, clipLength, maxResults }); } catch (err) { pending.delete(id); cleanup(); reject(err instanceof Error ? err : new Error(String(err))); }
  });
}

/** Full local ingest. Large files fail safely instead of falling back to a
 * memory-heavy main-thread decode that can kill mobile Safari. */
export async function analyzeWithHighlights(file: File, clipLength: ClipLength, maxResults: number, onProgress?: (p: number, stage?: string) => void, signal?: AbortSignal): Promise<AnalyzePayload | null> {
  assertSafeForLocalAnalysis(file);
  if (typeof Worker !== "undefined") {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const payload = await analyzeWithWorker(file, clipLength, maxResults, onProgress, signal);
        // Visual analysis is deliberately separate from audio decoding. It
        // samples a small number of frames and yields between seeks, avoiding
        // another full-file memory allocation.
        onProgress?.(0.82, "Reading visual events");
        const visualEvents = await analyzeVisualEvents(file, payload.analysis.duration, signal, (p) => onProgress?.(0.82 + p * 0.10, "Reading visual events"));
        payload.analysis.visualEvents = visualEvents;
        payload.highlights = runHighlightAnalysis({ ...payload.analysis, transcript: null, visualEvents, clipLength, maxResults });
        return payload;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        console.warn(`[ittyclip] analysis worker failed (attempt ${attempt + 1} of 2):`, err);
      }
    }
  }
  const analysis = await analyzeFileMain(file, onProgress, signal);
  const visualEvents = await analyzeVisualEvents(file, analysis.duration, signal);
  analysis.visualEvents = visualEvents;
  const highlights = runHighlightAnalysis({ ...analysis, transcript: null, visualEvents, clipLength, maxResults });
  return { analysis, highlights };
}

export async function analyzeFile(file: File, onProgress?: (p: number, stage?: string) => void, signal?: AbortSignal): Promise<AnalysisResult> {
  const payload = await analyzeWithHighlights(file, 30, 10, onProgress, signal);
  if (!payload) throw new Error("Analysis unavailable.");
  return payload.analysis;
}
