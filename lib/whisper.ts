"use client";

import type { CaptionLine } from "@/lib/types";
import { uid } from "@/lib/types";
import { buildWords } from "@/lib/captions";

export type WhisperModelKey = "tiny.en" | "base.en";

export const WHISPER_MODELS: Record<WhisperModelKey, { url: string; label: string; size: string; hint: string }> = {
  "tiny.en": {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
    label: "Tiny (fast)",
    size: "75 MB",
    hint: "blazing speed, decent accuracy",
  },
  "base.en": {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
    label: "Base (accurate)",
    size: "142 MB",
    hint: "best accuracy on typical CPUs",
  },
};

const MODEL_CACHE_NAME = "whisper.node.wasm.models";
const SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 45;
const NON_SPEECH_TAG = /^\[(?:music|musical|instrumental|applause|laughter|laughing|silence|noise|inaudible|background noise)\]$/i;

interface WasmWhisperModule {
  configureWasm: (opts: Record<string, unknown>) => void;
  initWhisper: (opts: { filePath: string; useGpu?: boolean; maxModelBytes?: number }) => Promise<WhisperCtx>;
}

interface WhisperCtx {
  transcribeData: (
    audio: ArrayBuffer,
    opts: {
      language?: string;
      temperature?: number;
      maxThreads?: number;
      tokenTimestamps?: boolean;
      onProgress?: (p: number) => void;
    }
  ) => { stop: () => Promise<void>; promise: Promise<WhisperResult> };
  release: () => Promise<void>;
}

interface WhisperResult {
  result: string;
  segments: { text: string; t0: number; t1: number }[];
  isAborted: boolean;
}

let modulePromise: Promise<WasmWhisperModule> | null = null;
let contextPromise: Promise<WhisperCtx | null> | null = null;
let modelInMemory: WhisperModelKey | null = null;

function isolated(): boolean {
  return typeof SharedArrayBuffer !== "undefined" && typeof crossOriginIsolated !== "undefined" && crossOriginIsolated === true;
}

function normalizeProgress(raw: number): number {
  const n = Number.isFinite(raw) ? raw : 0;
  const normalized = n > 1.001 ? n / 100 : n;
  return Math.min(1, Math.max(0, normalized));
}

async function loadModule(): Promise<WasmWhisperModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // @ts-expect-error native ESM import served from public/ (outside TS resolution)
      const mod = (await import(/* webpackIgnore: true */ "/wasm/node-whisper-wasm/index.js")) as unknown as WasmWhisperModule;
      mod.configureWasm({
        workerPath: "/wasm/node-whisper-wasm/worker.js",
        jsPath: isolated() ? "/wasm/node-whisper-wasm/wasm/whisper-node.threads.js" : "/wasm/node-whisper-wasm/wasm/whisper-node.js",
        wasmPath: isolated() ? "/wasm/node-whisper-wasm/wasm/whisper-node.threads.wasm" : "/wasm/node-whisper-wasm/wasm/whisper-node.wasm",
      });
      return mod;
    })();
  }
  return modulePromise;
}

export async function ensureModelCached(model: WhisperModelKey, onProgress?: (p: number) => void): Promise<void> {
  const url = WHISPER_MODELS[model].url;
  if (!("caches" in window)) {
    onProgress?.(1);
    return;
  }
  try {
    const cache = await caches.open(MODEL_CACHE_NAME);
    const key = new URL(url, window.location.href).href;
    if (await cache.match(key)) {
      onProgress?.(1);
      return;
    }
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`Could not download the Whisper model (HTTP ${response.status}).`);
    const total = Number(response.headers.get("content-length") || 0);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    onProgress?.(0.01);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        const fallbackTotal = 200_000_000;
        onProgress?.(total > 0 ? Math.min(0.99, received / total) : Math.min(0.99, received / fallbackTotal));
      }
    }
    await cache.put(key, new Response(new Blob(chunks as unknown as BlobPart[]), { headers: { "content-type": "application/octet-stream" } }));
    onProgress?.(1);
  } catch (err) {
    console.error("[ittyclip whisper] model cache failed:", err);
    throw err;
  }
}

async function getContext(model: WhisperModelKey): Promise<WhisperCtx | null> {
  if (contextPromise && modelInMemory === model) return contextPromise;
  if (contextPromise) {
    const prev = await contextPromise.catch(() => null);
    if (prev) await prev.release().catch(() => {});
  }
  contextPromise = (async () => {
    const mod = await loadModule();
    try {
      return await mod.initWhisper({ filePath: WHISPER_MODELS[model].url, useGpu: false });
    } catch (err) {
      console.error("[ittyclip whisper] init failed:", err);
      return null;
    }
  })();
  modelInMemory = model;
  return contextPromise;
}

export function audioBufferToPcm16(buffer: AudioBuffer): ArrayBuffer {
  const targetRate = SAMPLE_RATE;
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const mixed = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mixed[i] += data[i] / ch;
  }
  const ratio = buffer.sampleRate / targetRate;
  const outLen = Math.max(1, Math.round(len / ratio));
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const l = Math.min(len - 1, Math.floor(pos));
    const r = Math.min(l + 1, len - 1);
    const w = pos - l;
    const v = Math.max(-1, Math.min(1, mixed[l] * (1 - w) + mixed[r] * w));
    pcm[i] = Math.round(v * 32767);
  }
  return pcm.buffer;
}

function normalizeTimestamp(value: number, duration: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  // whisper.cpp builds commonly expose milliseconds; some WASM builds expose seconds.
  if (value <= duration * 1.5 + 1) return value;
  return value / 1000;
}

function isNonSpeech(text: string): boolean {
  return NON_SPEECH_TAG.test(text.trim().replace(/\s+/g, " "));
}

export async function transcribeCaptions(audioBuffer: AudioBuffer, model: WhisperModelKey, onProgress?: (p: number) => void): Promise<CaptionLine[]> {
  const ctx = await getContext(model);
  if (!ctx) throw new Error("Whisper engine failed to start in this browser.");

  const pcmBuffer = audioBufferToPcm16(audioBuffer);
  const pcm = new Int16Array(pcmBuffer);
  const chunkSamples = CHUNK_SECONDS * SAMPLE_RATE;
  const chunkCount = Math.max(1, Math.ceil(pcm.length / chunkSamples));
  const duration = Math.max(0.01, pcm.length / SAMPLE_RATE);
  const lines: CaptionLine[] = [];

  onProgress?.(0.01);

  try {
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const from = chunkIndex * chunkSamples;
      const to = Math.min(pcm.length, from + chunkSamples);
      const chunk = pcm.slice(from, to);
      const chunkOffset = from / SAMPLE_RATE;
      const chunkDuration = chunk.length / SAMPLE_RATE;
      let lastChunkProgress = 0;

      const { promise } = ctx.transcribeData(chunk.buffer, {
        language: "en",
        temperature: 0,
        tokenTimestamps: true,
        maxThreads: Math.max(1, Math.min(4, typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2)),
        onProgress: (raw) => {
          const local = normalizeProgress(raw);
          lastChunkProgress = Math.max(lastChunkProgress, local);
          onProgress?.(Math.min(0.995, (chunkIndex + local) / chunkCount));
        },
      });

      const result = await promise;
      if (result.isAborted) throw new Error("Transcription was stopped.");

      const rawSegments = Array.isArray(result.segments) ? result.segments : [];
      for (const seg of rawSegments) {
        const text = String(seg.text ?? "").replace(/\s+/g, " ").trim();
        if (!text || isNonSpeech(text)) continue;
        let start = chunkOffset + normalizeTimestamp(Number(seg.t0), chunkDuration);
        let end = chunkOffset + normalizeTimestamp(Number(seg.t1), chunkDuration);
        start = Math.min(duration, Math.max(chunkOffset, start));
        end = Math.min(duration, Math.max(start + 0.12, end));
        if (end <= start) continue;
        lines.push({ id: uid(), start, end, text, words: buildWords(text, start, end) });
      }

      onProgress?.(Math.min(0.995, (chunkIndex + Math.max(lastChunkProgress, 1)) / chunkCount));
    }
  } finally {
    onProgress?.(1);
  }

  lines.sort((a, b) => a.start - b.start);

  // Remove duplicate/overlapping repeated hallucinations while preserving genuine adjacent speech.
  const cleaned: CaptionLine[] = [];
  for (const line of lines) {
    const previous = cleaned[cleaned.length - 1];
    if (previous && line.start < previous.end && line.text.toLowerCase() === previous.text.toLowerCase()) {
      previous.end = Math.max(previous.end, line.end);
      previous.words = buildWords(previous.text, previous.start, previous.end);
      continue;
    }
    cleaned.push(line);
  }

  return cleaned;
}
