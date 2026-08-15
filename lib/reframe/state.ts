export type ReframeMode = "tracked" | "center";
export type ReframeStatus = "idle" | "detecting" | "tracking" | "done" | "error";

/** A smoothed subject position, normalized to the source frame [0..1]. */
export interface TrackPoint {
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReframeState {
  enabled: boolean;
  mode: ReframeMode;
  /** Horizontal focus offset, normalized [-1..1] (0 = centered). */
  offsetX: number;
  /** Vertical focus offset, normalized [-1..1] (0 = centered). */
  offsetY: number;
  /** Zoom factor applied on top of the aspect crop [1..2]. */
  scale: number;
  /** Smoothed subject track (null = never tracked or tracking failed). */
  track: TrackPoint[] | null;
  status: ReframeStatus;
}

export const DEFAULT_REFRAME: ReframeState = {
  enabled: false,
  mode: "center",
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  track: null,
  status: "idle",
};

export const REFRAME_SCALE_MIN = 1;
export const REFRAME_SCALE_MAX = 2;
