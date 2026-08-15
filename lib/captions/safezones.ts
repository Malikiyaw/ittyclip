/**
 * Safe zones for short-form platforms (TikTok / Reels / Shorts).
 * Values are fractions of the output frame. The caption safe zone is
 * typically the region below the UI elements (right-hand action rail).
 */
export const SAFE_ZONES = [
  {
    key: "tiktok",
    label: "TikTok",
    right: 0.22,
    bottom: 0.12,
    top: 0.1,
  },
  {
    key: "reels",
    label: "Reels",
    right: 0.2,
    bottom: 0.1,
    top: 0.12,
  },
  {
    key: "shorts",
    label: "Shorts",
    right: 0.18,
    bottom: 0.12,
    top: 0.1,
  },
] as const;

export type SafeZoneKey = (typeof SAFE_ZONES)[number]["key"];

/** Captions should stay inside this band (fraction of frame height from the bottom). */
export const CAPTION_SAFE_BOTTOM = 0.12;
export const CAPTION_SAFE_TOP = 0.12;
