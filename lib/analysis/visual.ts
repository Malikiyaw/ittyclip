import type { VisualEvent } from "@/lib/types";

const SAMPLE_LIMIT = 48;
const WIDTH = 160;
const HEIGHT = 90;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      video.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const fail = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      video.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
      reject(new Error("Could not seek video frame."));
    };
    const abort = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      video.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    video.addEventListener("seeked", finish, { once: true });
    video.addEventListener("error", fail, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    video.currentTime = Math.max(0, time);
  });
}

function averageDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let sum = 0;
  // Sample every fourth byte. We care about scene changes, not pixel-perfect similarity.
  for (let i = 0; i < a.length; i += 16) sum += Math.abs(a[i] - b[i]) / 255;
  return Math.min(1, sum / Math.max(1, Math.ceil(a.length / 16)) * 2.5);
}

/**
 * Lightweight visual event pass. It deliberately samples a small number of
 * frames so mobile devices don't decode the whole video into memory.
 * Face presence is detected with the existing MediaPipe tracking worker when
 * ImageBitmap transfer is available; visual change still works without it.
 */
export async function analyzeVisualEvents(
  file: Blob,
  duration: number,
  signal?: AbortSignal,
  onProgress?: (p: number) => void
): Promise<VisualEvent[]> {
  if (typeof document === "undefined" || duration <= 0 || signal?.aborted) return [];

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    URL.revokeObjectURL(url);
    return [];
  }

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve();
      const onError = () => reject(new Error("Could not load video for visual analysis."));
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });

    const count = Math.max(2, Math.min(SAMPLE_LIMIT, Math.ceil(duration / 2)));
    const events: VisualEvent[] = [];
    let previous: Uint8ClampedArray | null = null;

    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const time = duration * (i / Math.max(1, count - 1));
      await seek(video, time, signal);
      ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
      const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
      const change = previous ? averageDifference(previous, pixels) : 0;
      events.push({ time, change, face: false });
      previous = new Uint8ClampedArray(pixels);
      onProgress?.((i + 1) / count);
      // Yield between seeks so the Studio stays responsive on iOS/Safari.
      await wait(0);
    }

    return events;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.warn("[ittyclip] visual analysis skipped:", err);
    return [];
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
