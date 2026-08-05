"use client";

import { useStudio } from "@/store/studio";
import type { CaptionLine, CaptionStyleKey } from "@/lib/types";

const STYLE_CLASSES: Record<CaptionStyleKey, string> = {
  classic:
    "bg-black/65 rounded-xl px-5 py-3 text-center shadow-[0_4px_24px_rgba(0,0,0,0.5)] text-white",
  pop: "text-white font-bold tracking-tight [text-shadow:0_2px_0_#F472B6,0_4px_0_#7C5CFF,0_8px_16px_rgba(0,0,0,0.6)]",
  karaoke: "text-white font-bold",
  neon: "text-[#B9F6FF] font-semibold tracking-wide [text-shadow:0_0_8px_#22D3EE,0_0_24px_#22D3EE,0_0_48px_#7C5CFF]",
  minimal:
    "text-white/95 font-medium uppercase tracking-[0.3em] text-sm [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]",
  bold: "bg-gradient-to-r from-brand to-hot px-6 py-3 text-white font-black shadow-[0_8px_32px_rgba(124,92,255,0.4)] rounded-md text-center",
};

function KaraokeLine({ line, t }: { line: CaptionLine; t: number }) {
  return (
    <span className="inline-block rounded-lg bg-black/50 px-4 py-2">
      {line.words.length > 0
        ? line.words.map((w, i) => {
            const p = Math.min(1, Math.max(0, (t - w.start) / Math.max(0.001, w.end - w.start)));
            return (
              <span key={i} className="relative inline-block">
                <span className="text-white/35">{w.text}&nbsp;</span>
                <span
                  className="absolute inset-0 overflow-hidden whitespace-nowrap text-white"
                  style={{ width: `${p * 100}%` }}
                >
                  {w.text}&nbsp;
                </span>
              </span>
            );
          })
        : line.text}
    </span>
  );
}

export function CaptionOverlay() {
  const captions = useStudio((s) => s.captions);
  const style = useStudio((s) => s.captionStyle);
  const visible = useStudio((s) => s.showCaptions);
  const t = useStudio((s) => s.playhead);

  if (!visible) return null;
  const line = captions.find((c) => t >= c.start && t <= c.end);
  if (!line) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[22%] z-20 flex justify-center px-4">
      <p className={`font-display text-[clamp(1rem,3.2cqw,1.6rem)] leading-snug ${STYLE_CLASSES[style]}`}>
        {style === "karaoke" ? <KaraokeLine line={line} t={t} /> : line.text}
      </p>
    </div>
  );
}
