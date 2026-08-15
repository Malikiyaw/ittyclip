"use client";

import type { ReframeStatus, TrackPoint } from "@/lib/reframe/state";
import { normalizeTrack, smoothTrack, fillGaps } from "@/lib/reframe/smooth";

const SAMPLE_INTERVAL = 0.5;
const SAMPLE_WIDTH = 480;

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
 * Lazily loads MediaPipe FaceDetector. The wasm comes from the npm package's
 * CDN mirror; we never bundle it into the main app.
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

/**
 * Tracks the largest face across the video and returns a smoothed track.
 * Samples frames via canvas (VideoDecoder-free, safe everywhere).
 *
 * Returns null when no usable track could be produced — callers must fall
 * back to the center crop. Never throws for "no face found"; only for
 * genuine engine failures (callers catch those).
 */
export async function trackSubject(
  url: string,
  duration: number,
  onStatus?: (status: ReframeStatus) => void
): Promise<TrackPoint[] | null> {
  const detector = await getDetector();

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

  const canvas = document.createElement("canvas");
  const scale = SAMPLE_WIDTH / Math.max(1, video.videoWidth || 1920);
  canvas.width = SAMPLE_WIDTH;
  canvas.height = Math.round((video.videoHeight || 1080) * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    video.src = "";
    throw new Error("Canvas 2D is unavailable for face tracking.");
  }

  const raw: TrackPoint[] = [];
  const total = Math.max(1, duration || video.duration || 10);
  const steps = Math.max(4, Math.min(240, Math.round(total / SAMPLE_INTERVAL)));
  const stepSec = total / steps;

  onStatus?.("detecting");
  video.currentTime = 0;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.onerror = () => resolve();
  });

  const detectAt = async (t: number): Promise<TrackPoint | null> => {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.onseeked = done;
      video.onerror = done;
      if (Math.abs(video.currentTime - t) > 0.05) {
        video.currentTime = t;
      } else {
        resolve();
      }
    });
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.oncanplay = () => resolve();
        video.onerror = () => resolve();
        setTimeout(resolve, 3000);
      });
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = await detector.detect(canvas);
    const det = result.detections?.[0];
    if (!det) return null;
    const box = det.boundingBox;
    const cx = (box.originX + box.width / 2) / canvas.width;
    const cy = (box.originY + box.height / 2) / canvas.height;
    const w = box.width / canvas.width;
    const h = box.height / canvas.height;
    if (!isFinite(cx) || !isFinite(cy) || w <= 0 || h <= 0) return null;
    return { t, x: cx, y: cy, w, h };
  };

  onStatus?.("tracking");
  let detected = 0;
  for (let i = 0; i < steps; i++) {
    const t = Math.min(total - 0.05, i * stepSec);
    const point = await detectAt(t);
    if (point) {
      raw.push(point);
      detected++;
    }
  }

  video.src = "";
  video.removeAttribute("src");
  void canvas.getContext("2d")?.getTransform();

  if (detected < 4) return null;

  const normalized = normalizeTrack(raw);
  const filled = fillGaps(normalized, 1.5);
  const smoothed = smoothTrack(filled, 4);

  // Keep at most 120 points for the export expression.
  const step = Math.max(1, Math.round(smoothed.length / 120));
  return smoothed.filter((_, i) => i % step === 0);
}
