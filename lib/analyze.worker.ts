/**
 * Analysis Web Worker — runs the whole ingest pipeline (audio decode →
 * envelope → speech/silence/peaks → moments → local highlight ranking) off
 * the main thread so the studio never freezes, even for very large videos.
 *
 * Protocol:
 *   main → { id, type: "analyze", file, clipLength, maxResults }
 *   main → { id, type: "cancel" }
 *   worker → { id, type: "progress", p, stage }
 *   worker → { id, type: "result", result, highlights }
 *   worker → { id, type: "error", message }
 */
import {
  ANALYSIS_STAGES,
  HOP_MS,
  computeEnvelope,
  detectEnergyPeaks,
  detectMoments,
  detectSilence,
  detectSpeech,
} from "@/lib/analysis/extract";
import { runHighlightAnalysis } from "@/lib/analysis/engine";
import type { AnalysisResult, ClipLength, Moment } from "@/lib/types";
import type { RankedHighlight } from "@/lib/analysis/types";

const ctx = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};

interface AnalyzeRequest {
  id: number;
  type: "analyze";
  file: File;
  clipLength: ClipLength;
  maxResults: number;
}

interface CancelRequest {
  id: number;
  type: "cancel";
}

interface WorkerResult {
  duration: number;
  envelope: Float32Array;
  hopSec: number;
  speech: { start: number; end: number }[];
  energy: { time: number; value: number }[];
  moments: Moment[];
  silence: { start: number; end: number }[];
  highlights: RankedHighlight[];
}

const Ctx = (self as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;

function decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    if (!Ctx) {
      reject(new Error("OfflineAudioContext is unavailable in this worker."));
      return;
    }
    const audio = new Ctx(1, 1, 48000);
    const finish = (decoded: AudioBuffer) => {
      clearTimeout(timer);
      resolve(decoded);
    };
    const fail = (err?: unknown) => {
      clearTimeout(timer);
      reject(
        new Error("Could not decode audio track: " + ((err as { message?: string })?.message ?? "unknown error"))
      );
    };
    const timer = setTimeout(() => fail(new Error("decode timed out")), 120_000);
    try {
      const maybe = audio.decodeAudioData(arrayBuffer, finish, fail);
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === "function") {
        (maybe as Promise<AudioBuffer>).then(finish, fail);
      }
    } catch (err) {
      fail(err);
    }
  });
}

/**
 * A full-rate stereo decode of a long video is huge (a 2-hour 48 kHz stereo
 * buffer is ~2.7 GB of Float32), which can crash the worker and fall back to
 * a main-thread decode that kills the tab. The envelope only needs relative
 * loudness, so downmix to mono and resample to 16 kHz (8 kHz past one hour)
 * before any further processing. The returned buffer keeps the same duration
 * but a bounded size.
 */
const MAX_COMPACT_SAMPLES = 60 * 1024 * 1024; // 240 MB of Float32 — ~2 h at 8 kHz

function compactBuffer(buffer: AudioBuffer): AudioBuffer {
  if (!Ctx) return buffer;
  const duration = Math.max(0.01, buffer.duration);
  const targetRate = duration > 3600 ? 8000 : 16000;
  const samples = Math.min(Math.ceil(duration * targetRate), MAX_COMPACT_SAMPLES);
  const ctx = new Ctx(1, 1, targetRate);
  const out = ctx.createBuffer(1, samples, targetRate);
  const data = out.getChannelData(0);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const ratio = buffer.sampleRate / targetRate;
  for (let i = 0; i < samples; i++) {
    const pos = i * ratio;
    const l = Math.min(left.length - 1, Math.floor(pos));
    const r = Math.min(l + 1, left.length - 1);
    const w = pos - l;
    const mono = left[l] * (1 - w) + left[r] * w;
    data[i] = right ? 0.5 * (mono + right[l] * (1 - w) + right[r] * w) : mono;
  }
  return out;
}

const cancelled = new Set<number>();
let busy = false;

async function analyze(request: AnalyzeRequest): Promise<void> {
  const { id } = request;
  const emit = (idx: number) => {
    if (cancelled.has(id)) throw new DOMException("Aborted", "AbortError");
    const [p, stage] = ANALYSIS_STAGES[Math.min(idx, ANALYSIS_STAGES.length - 1)];
    ctx.postMessage({ type: "progress", id, p, stage });
  };

  try {
    emit(0);
    const arrayBuffer = await request.file.arrayBuffer();
    if (cancelled.has(id)) throw new DOMException("Aborted", "AbortError");
    const decoded = await decodeAudioData(arrayBuffer);
    emit(1);
    const buffer = compactBuffer(decoded);
    const env = await computeEnvelope(buffer, (fraction) => {
      if (cancelled.has(id)) throw new DOMException("Aborted", "AbortError");
      const [start, stage] = ANALYSIS_STAGES[1];
      const [end] = ANALYSIS_STAGES[2];
      ctx.postMessage({ type: "progress", id, p: start + fraction * (end - start), stage });
    });
    emit(2);
    const duration = buffer.duration;
    const silence = detectSilence(env, duration, HOP_MS);
    const speech = detectSpeech(env, duration, HOP_MS);
    emit(3);
    const energy = detectEnergyPeaks(env, HOP_MS, duration);
    emit(4);
    const moments = detectMoments(env, duration, HOP_MS);
    emit(5);
    const highlights = runHighlightAnalysis({
      envelope: env,
      hopSec: HOP_MS / 1000,
      duration,
      silence,
      transcript: null,
      clipLength: request.clipLength,
      maxResults: request.maxResults,
    });
    emit(6);
    emit(7);
    const result: WorkerResult = {
      duration,
      envelope: env,
      hopSec: HOP_MS / 1000,
      speech,
      energy,
      moments,
      silence,
      highlights,
    };
    ctx.postMessage({ type: "result", id, result }, [env.buffer]);
  } catch (err) {
    if (cancelled.has(id)) return;
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: "error", id, message });
  } finally {
    cancelled.delete(id);
  }
}

ctx.onmessage = (event: MessageEvent) => {
  const message = event.data as AnalyzeRequest | CancelRequest;
  if (message.type === "cancel") {
    cancelled.add(message.id);
    return;
  }
  if (message.type === "analyze") {
    if (busy) {
      ctx.postMessage({ type: "error", id: message.id, message: "Analysis worker is busy." });
      return;
    }
    busy = true;
    void analyze(message).finally(() => {
      busy = false;
    });
  }
};