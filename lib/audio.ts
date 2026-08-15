import type { AnalysisResult, ClipLength, Moment } from "@/lib/types";
import type { RankedHighlight } from "@/lib/analysis/types";
import {
  ANALYSIS_STAGES,
  HOP_MS,
  computeEnvelope,
  detectEnergyPeaks,
  detectMoments,
  detectSilence,
  detectSpeech,
  waveformPeaks,
} from "@/lib/analysis/extract";

export {
  ANALYSIS_STAGES,
  HOP_MS,
  computeEnvelope,
  detectEnergyPeaks,
  detectMoments,
  detectSilence,
  detectSpeech,
  waveformPeaks,
} from "@/lib/analysis/extract";
export type { AnalysisProgress } from "@/lib/analysis/extract";

function decodeAudio(file: Blob, signal?: AbortSignal): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    file.arrayBuffer().then((buf) => {
      if (signal?.aborted) {
        ctx.close().catch(() => {});
        return reject(new DOMException("Aborted", "AbortError"));
      }
      ctx.decodeAudioData(
        buf,
        (audio) => {
          ctx.close().catch(() => {});
          resolve(audio);
        },
        (err) => reject(new Error("Could not decode audio track: " + err?.message))
      );
    });
  });
}

export function decodeAudioFile(file: Blob, signal?: AbortSignal): Promise<AudioBuffer> {
  return decodeAudio(file, signal);
}

/** Main-thread fallback for the ingest pipeline (used when no worker is available). */
export async function analyzeFileMain(
  file: File,
  onProgress?: (p: number, stage?: string) => void,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const emit = (idx: number) => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const [p, stage] = ANALYSIS_STAGES[Math.min(idx, ANALYSIS_STAGES.length - 1)];
    onProgress?.(p, stage);
  };

  emit(0);
  const buffer = await decodeAudio(file, signal);
  emit(1);
  const env = computeEnvelope(buffer);
  emit(2);
  const duration = buffer.duration;
  const silence = detectSilence(env, duration, HOP_MS);
  const speech = detectSpeech(env, duration, HOP_MS);
  emit(3);
  const energy = detectEnergyPeaks(env, HOP_MS, duration);
  emit(4);
  const moments = detectMoments(env, duration, HOP_MS);
  emit(5);
  emit(6);
  emit(7);
  return { duration, envelope: env, speech, energy, moments, silence, hopSec: HOP_MS / 1000 };
}

interface AnalyzeWorkerResult {
  duration: number;
  envelope: Float32Array;
  hopSec: number;
  speech: { start: number; end: number }[];
  energy: { time: number; value: number }[];
  moments: Moment[];
  silence: { start: number; end: number }[];
  highlights: RankedHighlight[];
}

interface AnalyzePayload {
  analysis: AnalysisResult;
  highlights: RankedHighlight[];
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (payload: AnalyzePayload) => void; reject: (err: Error) => void }
>();

function getAnalyzeWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./analyze.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type: string; id: number; result?: AnalyzeWorkerResult; message?: string };
    const entry = pending.get(msg.id);
    if (!entry) return;
    if (msg.type === "result" && msg.result) {
      pending.delete(msg.id);
      const { highlights, envelope, ...rest } = msg.result;
      entry.resolve({ analysis: { ...rest, envelope }, highlights });
    } else if (msg.type === "error") {
      pending.delete(msg.id);
      // The worker may be in a broken state (busy or failed decode) — retire it
      // so the next attempt spins up a fresh one.
      try {
        worker?.terminate();
      } catch {
        /* already gone */
      }
      worker = null;
      entry.reject(new Error(msg.message || "Analysis worker error"));
    }
  };
  worker.onerror = () => {
    const entries = Array.from(pending.values());
    pending.clear();
    worker?.terminate();
    worker = null;
    for (const entry of entries) entry.reject(new Error("Analysis worker crashed"));
  };
  return worker;
}

function analyzeWithWorker(
  file: File,
  clipLength: ClipLength,
  maxResults: number,
  onProgress?: (p: number, stage?: string) => void,
  signal?: AbortSignal
): Promise<AnalyzePayload> {
  const w = getAnalyzeWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      pending.delete(id);
      try {
        w.postMessage({ type: "cancel", id });
      } catch {
        /* worker may already be gone */
      }
      try {
        w.terminate();
      } catch {
        /* already terminated */
      }
      if (worker === w) worker = null;
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    pending.set(id, {
      resolve: (payload) => {
        cleanup();
        resolve(payload);
      },
      reject: (err) => {
        cleanup();
        reject(err);
      },
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    w.postMessage({ type: "analyze", id, file, clipLength, maxResults });
  });
}

/**
 * Full ingest pipeline: decode + signals + local highlight ranking.
 * Runs on a Web Worker so the main thread NEVER blocks — if the worker is
 * unavailable, this returns `null` instead of degrading to a blocking
 * main-thread decode (which would freeze the studio on large videos).
 */
export async function analyzeWithHighlights(
  file: File,
  clipLength: ClipLength,
  maxResults: number,
  onProgress?: (p: number, stage?: string) => void,
  signal?: AbortSignal
): Promise<AnalyzePayload | null> {
  if (typeof Worker === "undefined") return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await analyzeWithWorker(file, clipLength, maxResults, onProgress, signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      console.warn(`[ittyclip] analysis worker failed (attempt ${attempt + 1} of 2):`, err);
    }
  }
  console.error("[ittyclip] analysis worker unavailable — proceeding without local analysis.");
  return null;
}

/**
 * Analyzes a video file into the signals the highlight engine consumes.
 * Reports real progress through `onProgress` and can be cancelled via
 * `signal` (throws DOMException AbortError). Backed by a Web Worker.
 */
export async function analyzeFile(
  file: File,
  onProgress?: (p: number, stage?: string) => void,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const payload = await analyzeWithHighlights(file, 30, 10, onProgress, signal);
  if (!payload) throw new Error("Analysis worker unavailable.");
  return payload.analysis;
}