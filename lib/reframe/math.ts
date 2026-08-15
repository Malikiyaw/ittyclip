import type { ReframeState, TrackPoint } from "@/lib/reframe/state";

export interface CropFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Computes the crop window for a given frame time.
 *
 * `tracked` mode follows the smoothed subject track; `center` mode uses the
 * manual offset/scale. All values are fractions of the source frame so the
 * same math drives both the preview transform and the export crop.
 */
export function reframeCropAt(
  t: number,
  srcW: number,
  srcH: number,
  aspect: number,
  reframe: ReframeState
): CropFrame {
  const baseW = srcW;
  const baseH = srcH;
  const srcAspect = baseW / baseH;

  let cropW = baseW;
  let cropH = baseH;
  // A narrower target aspect (e.g. 9:16 < 16:9) needs a narrower crop width;
  // a wider target needs a shorter crop height.
  if (aspect < srcAspect) cropW = baseH * aspect;
  else cropH = baseW / aspect;

  // Zoom (scale 1..2) shrinks the window from the target crop; the aspect
  // ratio is preserved by deriving the other dimension from it.
  const scale = reframe.scale || 1;
  cropW = Math.min(baseW, cropW / scale);
  cropH = cropW / aspect;
  if (cropH > baseH) {
    cropH = baseH;
    cropW = cropH * aspect;
  }

  let focusX = 0.5;
  let focusY = 0.5;
  if (reframe.mode === "tracked" && reframe.track && reframe.track.length > 0) {
    const p = pointAt(t, reframe.track);
    if (p) {
      focusX = p.x;
      focusY = p.y;
    }
  }
  // Manual offsets nudge the focus point (normalized -1..1 → ±25% shift).
  focusX = Math.max(0, Math.min(1, focusX + reframe.offsetX * 0.25));
  focusY = Math.max(0, Math.min(1, focusY + reframe.offsetY * 0.25));

  let x = focusX * baseW - cropW / 2;
  let y = focusY * baseH - cropH / 2;
  x = Math.max(0, Math.min(baseW - cropW, x));
  y = Math.max(0, Math.min(baseH - cropH, y));

  return { x, y, w: cropW, h: cropH };
}

/** Linearly interpolated track point at time t (clamped to track range). */
export function pointAt(t: number, track: TrackPoint[]): TrackPoint | null {
  if (track.length === 0) return null;
  if (t <= track[0].t) return track[0];
  const last = track[track.length - 1];
  if (t >= last.t) return last;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
      return {
        t,
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        w: a.w + (b.w - a.w) * f,
        h: a.h + (b.h - a.h) * f,
      };
    }
  }
  return last;
}
