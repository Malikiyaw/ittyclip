"use client";

import { useStudio } from "@/store/studio";
import type { CaptionLine } from "@/lib/types";
import { animationClass } from "@/lib/captions/presets";

function HighlightedWords({ line, t }: { line: CaptionLine; t: number }) {
  if (line.words.length === 0) {
    return <>{line.text}</>;
  }
  return (
    <>
      {line.words.map((w, i) => {
        const active = t >= w.start && t <= Math.max(w.end, w.start + 0.01);
        return (
          <span
            key={i}
            className={active ? "s-caption-word-active" : "s-caption-word"}
          >
            {w.text}
            {i < line.words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
}

export function CaptionOverlay() {
  const captions = useStudio((s) => s.captions);
  const settings = useStudio((s) => s.captionSettings);
  const visible = useStudio((s) => s.showCaptions);
  const t = useStudio((s) => s.playhead);

  if (!visible) return null;
  const line = captions.find((c) => t >= c.start && t <= c.end);
  if (!line) return null;

  const top = settings.position === "top" ? "12%" : settings.position === "middle" ? "48%" : "68%";
  const bg =
    settings.background === "solid"
      ? `rgba(0,0,0,${settings.backgroundOpacity})`
      : settings.background === "soft"
        ? `rgba(0,0,0,${settings.backgroundOpacity * 0.75})`
        : "transparent";
  const radius = settings.background === "none" ? 0 : 14;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
      style={{ top }}
    >
      <p
        key={line.id}
        className={`s-caption-anim-wrap text-center leading-snug ${animationClass(settings.animation)}`}
        style={{
          fontFamily: settings.font === "display" ? "Archivo Black, sans-serif" : "Inter, sans-serif",
          fontWeight: settings.weight,
          fontSize: `clamp(0.95rem, ${3.4 * settings.size}cqw, ${1.5 * settings.size}rem)`,
          lineHeight: settings.lineSpacing,
          color: settings.textColor,
          textTransform: settings.uppercase ? "uppercase" : "none",
          maxWidth: `${settings.maxWidth * 100}%`,
          background: bg,
          borderRadius: radius,
          padding: bg === "transparent" ? "0.1em 0" : "0.25em 0.6em",
          WebkitTextStroke: settings.stroke ? "1px rgba(0,0,0,0.85)" : "none",
          textShadow: settings.shadow ? "0 2px 12px rgba(0,0,0,0.85)" : "none",
          ["--hl" as string]: settings.highlightColor,
        }}
      >
        <HighlightedWords line={line} t={t} />
      </p>
    </div>
  );
}
