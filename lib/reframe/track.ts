"use client";

import type { ReframeStatus, TrackPoint } from "@/lib/reframe/state";
import { normalizeTrack, smoothTrack, fillGaps } from "@/lib/reframe/smooth";

const SAMPLE_INTERVAL = 0.5;
const SAMPLE_WIDTH = 480;

export interface TrackOptions {
  onStatus?: (status: ReframeStatus) => void;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

interface FaceDetectorLike {
  detect: (
    source: ImageData | HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ) => Promise<{ detections: { boundingBox: { originX: number; originY: number; width: number; height: number } }[] }>;
  close: () => Promise<void>;
}

interface TasksVisionModule {
  FilesetResolver: {
    forVisionTasks: (url: string) => Promise<unknown>;
  };
  FaceDetector: {
    createFromOptions: (fileset: unknown, opts: Record<string, unknown>) => Promise<FaceDetectorLike>;
  };
}

let detectorPromise: Promise<FaceDetectorLike> | null = null;

/**
 * Lazily loads MediaPipe FaceDetector for the main-thread fallback path.
 * The wasm comes from the npm package's CDN mirror; we never bundle it.
 */
async function getDetector(): Promise<FaceDetectorLike> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const mod = (await import("@mediapipe/tasks-vision")) as unknown as TasksVisionModule;
    const fileset = await mod.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
    );
    return mod.FaceDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.55,
    });
  })();
  return detectorPromise;
}

function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    video.onseeked = done;
    video.onerror = done;
    if (Math.abs(video.currentTime - t) > 0.05) {
      video.currentTime = t;
    } else {
      resolve();
    }
  });
}

function waitCanplay(video: HTMLVideoElement): Promise<void> {
  return new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.oncanplay = () => resolve();
    video.onerror = () => resolve();
    setTimeout(resolve, 3000);
  });
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Normalizes, fills and smooths the raw detections into an export-ready track. */
function finalize(raw: TrackPoint[]): TrackPoint[] | null {
  if (raw.length < 4) return null;
  const normalized = normalizeTrack(raw);
  const filled = fillGaps(normalized, 1.5);
  const smoothed = smoothTrack(filled, 4);
  // Keep at most 120 points for the export expression.
  const step = Math.max(1, Math.round(smoothed.length / 120));
  return smoothed.filter((_, i) => i % step === 0);
}

interface WorkerPoint {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Worker-based tracking: the main thread seeks the video and hands each
 * sampled frame to a Web Worker as a transferred ImageBitmap. MediaPipe
 * inference runs off the main thread so the UI never freezes.
 */
async function trackWithWorker(
  video: HTMLVideoElement,
  duration: number,
  options: TrackOptions
): Promise<TrackPoint[]> {
  const { onStatus, onProgress, signal } = options;
  const w = new Worker(new URL("../track.worker.ts", import.meta.url), { type: "module" });
  let nextId = 0;
  const pending = new Map<number, (point: WorkerPoint | null) => void>();
  const closed = { value: false };
  const crashed = { value: false };

  let initResolve!: () => void;
  let initReject!: (err: Error) => void;
  const initReady = new Promise<void>((resolve, reject) => {
    initResolve = resolve;
    initReject = reject;
  });

  const closeWorker = () => {
    if (closed.value) return;
    closed.value = true;
    try {
      w.postMessage({ type: "close" });
    } catch {
      /* worker may already be gone */
    }
    for (const resolve of pending.values()) resolve(null);
    pending.clear();
  };
  const abortHandler = () => closeWorker();
  signal?.addEventListener("abort", abortHandler, { once: true });

  w.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type: string; id?: number; point?: WorkerPoint | null; message?: string };
    if (msg.type === "init-done") {
      initResolve();
      return;
    }
    if (msg.type === "init-error") {
      initReject(new Error(msg.message || "Tracking worker failed to initialize."));
      return;
    }
    if (msg.type === "point") {
      const resolve = pending.get(msg.id as number);
      if (resolve) {
        pending.delete(msg.id as number);
        resolve(msg.point ?? null);
      }
    }
  };
  w.onerror = () => {
    crashed.value = true;
    initReject(new Error("Tracking worker crashed."));
    for (const resolve of pending.values()) resolve(null);
    pending.clear();
  };

  try {
    w.postMessage({ type: "init" });
    await initReady;
  } catch (err) {
    signal?.removeEventListener("abort", abortHandler);
    closeWorker();
    throw err;
  }

  const total = Math.max(1, duration || video.duration || 10);
  const steps = Math.max(4, Math.min(240, Math.round(total / SAMPLE_INTERVAL)));
  const stepSec = total / steps;

  onStatus?.("detecting");
  video.currentTime = 0;
  await seekVideo(video, 0);
  onStatus?.("tracking");

  const raw: TrackPoint[] = [];
  for (let i = 0; i < steps; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const t = Math.min(total - 0.05, i * stepSec);
    await seekVideo(video, t);
    await waitCanplay(video);
    const sampleHeight = Math.round(
      (video.videoHeight || 1080) * (SAMPLE_WIDTH / Math.max(1, video.videoWidth || 1920))
    );
    const bitmap = await createImageBitmap(video, {
      resizeWidth: SAMPLE_WIDTH,
      resizeHeight: sampleHeight,
      resizeQuality: "low",
    });
    if (signal?.aborted) {
      bitmap.close();
      throw new DOMException("Aborted", "AbortError");
    }
    const id = ++nextId;
    const point = await new Promise<WorkerPoint | null>((resolve) => {
      pending.set(id, resolve);
      w.postMessage({ type: "detect", id, bitmap }, [bitmap]);
    });
    if (point) raw.push({ t, ...point });
    if (crashed.value) break;
    onProgress?.(Math.min(1, (i + 1) / steps));
    if (i % 8 === 7) await yieldToMain();
  }

  signal?.removeEventListener("abort", abortHandler);
  closeWorker();
  return raw;
}

/** Main-thread fallback (canvas + GPU detector), chunked with yields. */
async function trackOnMain(
  video: HTMLVideoElement,
  duration: number,
  options: TrackOptions
): Promise<TrackPoint[]> {
  const { onStatus, onProgress, signal } = options;
  const detector = await getDetector();

  const canvas = document.createElement("canvas");
  const scale = SAMPLE_WIDTH / Math.max(1, video.videoWidth || 1920);
  canvas.width = SAMPLE_WIDTH;
  canvas.height = Math.round((video.videoHeight || 1080) * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is unavailable for face tracking.");

  const total = Math.max(1, duration || video.duration || 10);
  const steps = Math.max(4, Math.min(240, Math.round(total / SAMPLE_INTERVAL)));
  const stepSec = total / steps;

  onStatus?.("detecting");
  video.currentTime = 0;
  await seekVideo(video, 0);
  onStatus?.("tracking");

  const raw: TrackPoint[] = [];
  for (let i = 0; i < steps; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const t = Math.min(total - 0.05, i * stepSec);
    await seekVideo(video, t);
    await waitCanplay(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = await detector.detect(canvas);
    const det = result.detections?.[0];
    if (det) {
      const box = det.boundingBox;
      const cx = (box.originX + box.width / 2) / canvas.width;
      const cy = (box.originY + box.height / 2) / canvas.height;
      const w = box.width / canvas.width;
      const h = box.height / canvas.height;
      if (isFinite(cx) && isFinite(cy) && w > 0 && h > 0) raw.push({ t, x: cx, y: cy, w, h });
    }
    onProgress?.(Math.min(1, (i + 1) / steps));
    if (i % 8 === 7) await yieldToMain();
  }
  return raw;
}

/**
 * Tracks the largest face across the video and returns a smoothed track.
 * Samples frames off the main thread via a Web Worker; falls back to the
 * main-thread canvas path when the worker is unavailable.
 *
 * Returns null when no usable track could be produced — callers must fall
 * back to the center crop. Never throws for "no face found"; only for
 * genuine engine failures (callers catch those). Throws AbortError when
 * `signal` is aborted.
 */
export async function trackSubject(
  url: string,
  duration: number,
  options: TrackOptions = {}
): Promise<TrackPoint[] | null> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  video.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out loading video for tracking.")), 20_000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Could not load the video for tracking."));
    };
  });

  try {
    let raw: TrackPoint[] | null = null;
    if (typeof Worker !== "undefined" && typeof createImageBitmap === "function") {
      try {
        raw = await trackWithWorker(video, duration, options);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        console.warn("[ittyclip] tracking worker unavailable — falling back to main thread:", err);
        raw = null;
      }
    }
    if (raw === null) raw = await trackOnMain(video, duration, options);
    return finalize(raw);
  } finally {
    video.src = "";
    video.removeAttribute("src");
  }
}