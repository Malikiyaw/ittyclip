"use client";

import type { CaptionLine } from "@/lib/types";
import { uid } from "@/lib/types";
import { buildWords } from "@/lib/captions";

export type WhisperModelKey = "tiny.en" | "base.en";

export const WHISPER_MODELS: Record<
  WhisperModelKey,
  { url: string; label: string; size: string; hint: string }
> = {
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

interface WasmWhisperModule {
  configureWasm: (opts: Record<string, unknown>) => void;
  initWhisper: (opts: {
    filePath: string;
    useGpu?: boolean;
    maxModelBytes?: number;
  }) => Promise<WhisperCtx>;
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
  return (
    typeof SharedArrayBuffer !== "undefined" &&
    typeof crossOriginIsolated !== "undefined" &&
    crossOriginIsolated === true
  );
}

async function loadModule(): Promise<WasmWhisperModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // @ts-expect-error native ESM import served from public/ (outside TS resolution)
      const mod = (await import(/* webpackIgnore: true */ "/wasm/node-whisper-wasm/index.js")) as unknown as WasmWhisperModule;
      mod.configureWasm({
        workerPath: "/wasm/node-whisper-wasm/worker.js",
        jsPath: isolated()
          ? "/wasm/node-whisper-wasm/wasm/whisper-node.threads.js"
          : "/wasm/node-whisper-wasm/wasm/whisper-node.js",
        wasmPath: isolated()
          ? "/wasm/node-whisper-wasm/wasm/whisper-node.threads.wasm"
          : "/wasm/node-whisper-wasm/wasm/whisper-node.wasm",
      });
      return mod;
    })();
  }
  return modulePromise;
}

export async function ensureModelCached(
  model: WhisperModelKey,
  onProgress?: (p: number) => void
): Promise<void> {
  const url = WHISPER_MODELS[model].url;
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(MODEL_CACHE_NAME);
    const key = new URL(url, window.location.href).href;
    if (await cache.match(key)) return;
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    const total = Number(response.headers.get("content-length") || 0);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress?.(total ? Math.min(0.98, received / total) : Math.min(0.98, received / 200_000_000));
    }
    await cache.put(key, new Response(new Blob(chunks as unknown as BlobPart[]), { headers: { "content-type": "application/octet-stream" } }));
    onProgress?.(1);
  } catch {
    onProgress?.(1);
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
  const targetRate = 16000;
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
    const l = Math.floor(pos);
    const r = Math.min(l + 1, len - 1);
    const w = pos - l;
    const v = Math.max(-1, Math.min(1, mixed[l] * (1 - w) + mixed[r] * w));
    pcm[i] = Math.round(v * 32767);
  }
  return pcm.buffer;
}

export async function transcribeCaptions(
  audioBuffer: AudioBuffer,
  model: WhisperModelKey,
  onProgress?: (p: number) => void
): Promise<CaptionLine[]> {
  const ctx = await getContext(model);
  if (!ctx) throw new Error("Whisper engine failed to start in this browser.");
  const pcm = audioBufferToPcm16(audioBuffer);
  const { promise } = ctx.transcribeData(pcm, {
    language: "en",
    temperature: 0,
    tokenTimestamps: true,
    onProgress: (p) => onProgress?.(p / 100),
  });
  const result = await promise;
  if (result.isAborted) throw new Error("Transcription was stopped.");
  const lines: CaptionLine[] = result.segments
    .map((seg) => {
      const text = seg.text.replace(/\s+/g, " ").trim();
      if (!text) return null;
      const start = seg.t0 / 1000;
      const end = seg.t1 / 1000;
      return {
        id: uid(),
        start,
        end: Math.max(start + 0.12, end),
        text,
        words: buildWords(text, start, end),
      };
    })
    .filter((l): l is CaptionLine => l !== null);
  return lines;
}
