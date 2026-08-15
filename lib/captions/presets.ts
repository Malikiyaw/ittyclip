import type { CaptionAnimation, CaptionSettings } from "@/lib/types";

/** Default caption settings — Pop preset, matching the pre-existing default style. */
export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  font: "display",
  size: 1,
  weight: "bold",
  textColor: "#FFFFFF",
  highlightColor: "#F7C948",
  position: "bottom",
  maxWidth: 0.86,
  stroke: false,
  shadow: true,
  background: "none",
  backgroundOpacity: 0.55,
  lineSpacing: 1.25,
  animation: "word-pop",
  uppercase: false,
};

export const CAPTION_PRESETS: Record<CaptionPresetKey, CaptionSettings> = {
  classic: {
    font: "display",
    size: 0.95,
    weight: "normal",
    textColor: "#FFFFFF",
    highlightColor: "#FFFFFF",
    position: "bottom",
    maxWidth: 0.9,
    stroke: false,
    shadow: false,
    background: "solid",
    backgroundOpacity: 0.65,
    lineSpacing: 1.2,
    animation: "none",
    uppercase: false,
  },
  pop: { ...DEFAULT_CAPTION_SETTINGS },
  karaoke: {
    font: "display",
    size: 1.1,
    weight: "bold",
    textColor: "#FFFFFF",
    highlightColor: "#F7C948",
    position: "bottom",
    maxWidth: 0.9,
    stroke: true,
    shadow: true,
    background: "soft",
    backgroundOpacity: 0.4,
    lineSpacing: 1.3,
    animation: "word-pop",
    uppercase: false,
  },
  neon: {
    font: "display",
    size: 1.05,
    weight: "semibold",
    textColor: "#B9F6FF",
    highlightColor: "#22D3EE",
    position: "bottom",
    maxWidth: 0.85,
    stroke: false,
    shadow: true,
    background: "none",
    backgroundOpacity: 0,
    lineSpacing: 1.25,
    animation: "fade",
    uppercase: false,
  },
  minimal: {
    font: "sans",
    size: 0.8,
    weight: "semibold",
    textColor: "#FFFFFF",
    highlightColor: "#FFFFFF",
    position: "bottom",
    maxWidth: 0.9,
    stroke: false,
    shadow: true,
    background: "none",
    backgroundOpacity: 0,
    lineSpacing: 1.4,
    animation: "fade",
    uppercase: true,
  },
  bold: {
    font: "display",
    size: 1.15,
    weight: "black",
    textColor: "#000000",
    highlightColor: "#F7C948",
    position: "bottom",
    maxWidth: 0.86,
    stroke: false,
    shadow: true,
    background: "solid",
    backgroundOpacity: 1,
    lineSpacing: 1.2,
    animation: "pop",
    uppercase: false,
  },
};

export type CaptionPresetKey = "classic" | "pop" | "karaoke" | "neon" | "minimal" | "bold";

export function presetFor(key: CaptionPresetKey): CaptionSettings {
  return { ...(CAPTION_PRESETS[key] ?? CAPTION_PRESETS.pop) };
}

/** Animation CSS class applied to the caption wrapper. */
export function animationClass(animation: CaptionAnimation): string {
  switch (animation) {
    case "pop":
      return "s-caption-anim-pop";
    case "fade":
      return "s-caption-anim-fade";
    case "slide-up":
      return "s-caption-anim-slide";
    case "word-pop":
      return "s-caption-anim-word";
    case "none":
    default:
      return "";
  }
}
