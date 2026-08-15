import type { ReframeState, TrackPoint } from "@/lib/reframe/state";
import { reframeCropAt } from "@/lib/reframe/math";

/**
 * Builds an ffmpeg `crop` filter expression from a reframe state.
 *
 * Returns `null` when reframing is off. For tracked mode the crop window
 * follows the smoothed subject track via a piecewise-linear expression
 * (`if(gte(t,ts), x0+(t-ts)*slope, ...)`); for center mode a fixed crop
 * with manual offsets is used.
 *
 * The expression operates in source pixels — the caller still needs to
 * know the source dimensions (we default to 1920x1080 like the rest of
 * the export pipeline).
 */
export function buildCropExpression(
  reframe: ReframeState,
  aspect: number,
  srcW = 1920,
  srcH = 1080,
  duration = 600
): string | null {
  if (!reframe.enabled) return null;

  if (reframe.mode === "center" || !reframe.track || reframe.track.length < 2) {
    const crop = reframeCropAt(0, srcW, srcH, aspect, {
      ...reframe,
      mode: "center",
      track: null,
    });
    const x = Math.round(crop.x);
    const y = Math.round(crop.y);
    return `crop=${Math.round(crop.w)}:${Math.round(crop.h)}:${x}:${y}`;
  }

  const track = reframe.track;
  const cropW = cropSizeFor(reframe, srcW, srcH, aspect, track[0].t);
  const w = Math.round(cropW.w);
  const h = Math.round(cropW.h);

  const xExpr = piecewiseLinear(track, srcW, w);
  const yExpr = piecewiseLinear(track, srcH, h);

  return `crop=${w}:${h}:${xExpr}:${yExpr}`;
}

function cropSizeFor(reframe: ReframeState, srcW: number, srcH: number, aspect: number, t: number) {
  const frame = reframeCropAt(t, srcW, srcH, aspect, reframe);
  return { w: frame.w, h: frame.h };
}

/**
 * Builds a piecewise-linear expression for crop x/y:
 *   if(lt(t,t1), v0+(t-t0)*s0, if(lt(t,t2), v1+(t-t1)*s1, ... vn))
 * Clamped to the valid range of the crop window inside the source frame.
 */
function piecewiseLinear(track: TrackPoint[], srcSize: number, cropSize: number): string {
  const maxOffset = Math.max(0, srcSize - cropSize);
  const toPx = (frac: number) => {
    const raw = frac * srcSize - cropSize / 2;
    return Math.round(Math.max(0, Math.min(maxOffset, raw)));
  };

  const n = track.length;
  if (n <= 2) {
    const v = toPx(track[0].x);
    return String(v);
  }

  const segs: { t: number; v: number; slope: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const t0 = track[i].t;
    const t1 = track[i + 1].t;
    const v0 = toPx(track[i].x);
    const v1 = toPx(track[i + 1].x);
    const dt = Math.max(0.001, t1 - t0);
    segs.push({ t: t1, v: v0, slope: (v1 - v0) / dt });
  }

  // Nest from the end: last segment is a constant value.
  let expr = String(toPx(track[n - 1].x));
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    expr = `if(lt(t,${s.t.toFixed(3)}),${s.v}+(t-${track[i].t.toFixed(3)})*${s.slope.toFixed(4)},${expr})`;
  }

  // Clamp so the crop never leaves the frame.
  return `max(0,min(${maxOffset},${expr}))`;
}
