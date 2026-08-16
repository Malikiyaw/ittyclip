"use client";

import { useStudio } from "@/store/studio";
import type { CaptionLine, CaptionStyleKey } from "@/lib/types";
import { animationClass } from "@/lib/captions/presets";

function HighlightedWords({ line, t, style }: { line: CaptionLine; t: number; style: CaptionStyleKey }) {
  if (line.words.length === 0) return <>{line.text}</>;
  return (
    <>
      {line.words.map((w, i) => {
        const active = t >= w.start && t <= Math.max(w.end, w.start + 0.01);
        const activeStyle = active
          ? style === "neon"
            ? { color: "var(--hl)", textShadow: "0 0 8px var(--hl), 0 0 18px var(--hl)" }
            : style === "bold"
              ? { color: "#000000", background: "var(--hl)", borderRadius: "0.16em", padding: "0 0.08em" }
              : style === "classic"
                ? { color: "#000000", background: "#ffffff", borderRadius: "0.12em", padding: "0 0.08em" }
                : { color: "var(--hl)" }
          : undefined;
        return (
          <span key={`${w.start}-${i}`} className={active ? "s-caption-word-active" : "s-caption-word"} style={activeStyle}>
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
  const style = useStudio((s) => s.captionStyle);
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

  const styleVisual = (() => {
    switch (style) {
      case "classic": return { letterSpacing: "0.01em", textTransform: "none" as const };
      case "pop": return { letterSpacing: "-0.02em", textTransform: "none" as const };
      case "karaoke": return { letterSpacing: "-0.025em", textTransform: "none" as const };
      case "neon": return { letterSpacing: "0.025em", textTransform: "uppercase" as const };
      case "minimal": return { letterSpacing: "0.06em", textTransform: "uppercase" as const };
      case "bold": return { letterSpacing: "-0.045em", textTransform: "none" as const };
    }
  })();

  const styleShadow =
    style === "neon"
      ? `0 0 8px ${settings.textColor}, 0 0 22px ${settings.textColor}, 0 3px 18px rgba(0,0,0,0.65)`
      : style === "bold"
        ? "0 3px 0 rgba(255,255,255,0.22), 0 5px 18px rgba(0,0,0,0.75)"
        : settings.shadow
          ? "0 2px 12px rgba(0,0,0,0.85)"
          : "none";

  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4" style={{ top }}>
      <p
        key={line.id}
        className={`s-caption-anim-wrap text-center leading-snug ${animationClass(settings.animation)}`}
        style={{
          fontFamily: settings.font === "display" ? "Archivo Black, sans-serif" : "Inter, sans-serif",
          fontWeight: settings.weight,
          fontSize: `clamp(0.95rem, ${3.4 * settings.size}cqw, ${1.5 * settings.size}rem)`,
          lineHeight: settings.lineSpacing,
          color: settings.textColor,
          textTransform: settings.uppercase ? "uppercase" : styleVisual.textTransform,
          letterSpacing: styleVisual.letterSpacing,
          maxWidth: `${settings.maxWidth * 100}%`,
          background: bg,
          borderRadius: radius,
          padding: bg === "transparent" ? "0.1em 0" : "0.25em 0.6em",
          WebkitTextStroke: settings.stroke || style === "karaoke" ? "1px rgba(0,0,0,0.85)" : "none",
          textShadow: styleShadow,
          ["--hl" as string]: settings.highlightColor,
          ...(style === "neon" ? { filter: "saturate(1.2)" } : {}),
        }}
      >
        <HighlightedWords line={line} t={t} style={style} />
      </p>
    </div>
  );
}
