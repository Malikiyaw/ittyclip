/**
 * Face-tracking Web Worker — runs MediaPipe FaceDetector inference off the
 * main thread. The main thread only seeks the video and hands the worker a
 * downscaled ImageBitmap (transferred, zero-copy) for each sampled frame.
 *
 * Protocol:
 *   main → { type: "init" }
 *   worker → { type: "init-done" } | { type: "init-error", message }
 *   main → { type: "detect", id, bitmap }   (bitmap transferred)
 *   worker → { type: "point", id, point }   (point = {x,y,w,h} | null)
 *   main → { type: "close" }
 */
import type { TrackPoint } from "@/lib/reframe/state";

const ctx = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent) => void) | null;
  close: () => void;
};

interface FaceDetectorLike {
  detect: (
    source: ImageBitmap
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

let detectorPromise: Promise<FaceDetectorLike | null> | null = null;

function getDetector(): Promise<FaceDetectorLike | null> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const mod = (await import("@mediapipe/tasks-vision")) as unknown as TasksVisionModule;
      const fileset = await mod.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );
      return mod.FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          // CPU runs reliably inside a Worker (GPU needs WebGL on the main thread).
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.55,
      });
    })().catch((err) => {
      console.error("[ittyclip tracking worker] detector init failed:", err);
      return null;
    });
  }
  return detectorPromise;
}

ctx.onmessage = async (event: MessageEvent) => {
  const message = event.data as { type: string; id?: number; bitmap?: ImageBitmap };
  if (message.type === "init") {
    const detector = await getDetector();
    ctx.postMessage(
      detector ? { type: "init-done" } : { type: "init-error", message: "Face detector failed to start." }
    );
    return;
  }
  if (message.type === "detect") {
    const detector = await getDetector();
    const id = message.id as number;
    const bitmap = message.bitmap as ImageBitmap;
    let point: { x: number; y: number; w: number; h: number } | null = null;
    if (detector && bitmap) {
      try {
        const result = await detector.detect(bitmap);
        const box = result.detections?.[0]?.boundingBox;
        if (box) {
          const bw = bitmap.width;
          const bh = bitmap.height;
          const x = (box.originX + box.width / 2) / bw;
          const y = (box.originY + box.height / 2) / bh;
          const w = box.width / bw;
          const h = box.height / bh;
          if (isFinite(x) && isFinite(y) && w > 0 && h > 0) point = { x, y, w, h };
        }
      } catch {
        point = null;
      }
    }
    try {
      bitmap.close();
    } catch {
      /* already closed */
    }
    ctx.postMessage({ type: "point", id, point });
    return;
  }
  if (message.type === "close") {
    const detector = await getDetector();
    if (detector) await detector.close().catch(() => {});
    detectorPromise = null;
    ctx.close();
  }
};