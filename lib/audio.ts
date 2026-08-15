import type { AnalysisResult, ClipLength, Moment } from "@/lib/types";
import { runHighlightAnalysis } from "@/lib/analysis/engine";
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
    let settled = false;
    const close = () => {
      ctx.close().catch(() => {});
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      close();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    file.arrayBuffer().then((buf) => {
      if (signal?.aborted) return fail(new DOMException("Aborted", "AbortError"));
      ctx.decodeAudioData(
        buf,
        (audio) => {
          if (settled) return;
          settled = true;
          close();
          resolve(audio);
        },
        (err) => fail(new Error("Could not decode audio track: " + (err?.message || "unknown decode error")))
      );
    }).catch((err) => fail(err));
  });
}

export function decodeAudioFile(file: Blob, signal?: AbortSignal): Promise<AudioBuffer> {
  return decodeAudio(file, signal);
}

/**
 * Main-thread fallback for the ingest pipeline (used when no worker is
 * available). Every heavy step yields to the event loop so the UI never
 * freezes; only `decodeAudioData` itself is a single blocking call.
 */
export async function analyzeFileMain(
  file: File,
  onProgress?: (p: number, stage?: string) => void,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const emit = (idx: number) => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const [p, stage] = ANALYSIS_STAGES[Math.min(idx, ANALYSIS_STAGES.length - 1)];
    onProgress?.(p, stage);
  };

  emit(0);
  await yieldToMain();
  const buffer = await decodeAudio(file, signal);
  emit(1);
  await yieldToMain();
  const env = await computeEnvelope(buffer, () => {}, 4096);
  emit(2);
  const duration = buffer.duration;
  await yieldToMain();
  const silence = detectSilence(env, duration, HOP_MS);
  await yieldToMain();
  const speech = detectSpeech(env, duration, HOP_MS);
  await yieldToMain();
  emit(3);
  const energy = detectEnergyPeaks(env, HOP_MS, duration);
  await yieldToMain();
  emit(4);
  const moments = detectMoments(env, duration, HOP_MS);
  await yieldToMain();
  emit(5);
  await yieldToMain();
  emit(6);
  await yieldToMain();
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
 * Primary path is a Web Worker so the main thread never blocks. If the
 * worker is unavailable, it falls back to a time-sliced main-thread
 * implementation that yields to the event loop between every heavy step —
 * analysis always runs, and the studio stays responsive either way.
 */
export async function analyzeWithHighlights(
  file: File,
  clipLength: ClipLength,
  maxResults: number,
  onProgress?: (p: number, stage?: string) => void,
  signal?: AbortSignal
): Promise<AnalyzePayload | null> {
  if (typeof Worker !== "undefined") {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await analyzeWithWorker(file, clipLength, maxResults, onProgress, signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        console.warn(`[ittyclip] analysis worker failed (attempt ${attempt + 1} of 2):`, err);
      }
    }
    console.warn("[ittyclip] analysis worker unavailable — using chunked main-thread analysis.");
  }
  const analysis = await analyzeFileMain(file, onProgress, signal);
  const highlights = runHighlightAnalysis({
    envelope: analysis.envelope,
    hopSec: analysis.hopSec,
    duration: analysis.duration,
    silence: analysis.silence,
    transcript: null,
    clipLength,
    maxResults,
  });
  return { analysis, highlights };
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
