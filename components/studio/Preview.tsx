"use client";

import { useEffect, useRef } from "react";
import { useStudio } from "@/store/studio";
import { CaptionOverlay } from "@/components/studio/CaptionOverlay";
import { ASPECTS, fmtClock, type AspectKey } from "@/lib/types";

const ASPECT_BUTTONS: { key: AspectKey; label: string }[] = [
  { key: "9:16", label: "9:16" },
  { key: "1:1", label: "1:1" },
  { key: "4:5", label: "4:5" },
  { key: "16:9", label: "16:9" },
];

export function Preview() {
  const media = useStudio((s) => s.media);
  const aspect = useStudio((s) => s.aspect);
  const playhead = useStudio((s) => s.playhead);
  const isPlaying = useStudio((s) => s.isPlaying);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const setPlaying = useStudio((s) => s.setPlaying);
  const tick = useStudio((s) => s.tick);

  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media) return;
    video.currentTime = Math.min(playhead, Math.max(0, (media.duration || 0) - 0.01));
  }, [media]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        if (video.ended || video.currentTime >= (useStudio.getState().media?.duration ?? 0)) {
          setPlaying(false);
          return;
        }
        tick(video.currentTime);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      video.pause();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick, setPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media) return;
    video.currentTime = Math.min(playhead, Math.max(0, (media.duration || 0) - 0.01));
  }, [playhead, media]);

  if (!media) return null;
  const duration = media.duration || 0;
  const ratio = ASPECTS[aspect].ratio;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-6">
        <div className="studio-grid" aria-hidden />
        <span className="absolute top-4 left-5 z-10 font-mono text-[10px] tracking-[0.3em] text-white/30 uppercase">
          preview
        </span>
        <div className="relative h-full max-h-full" style={{ aspectRatio: ratio }}>
          <video
            ref={videoRef}
            src={media.url}
            className="h-full w-full rounded-2xl bg-black object-cover shadow-[0_40px_100px_rgba(0,0,0,0.85)] ring-1 ring-white/15"
            playsInline
            muted
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" aria-hidden />
          <CaptionOverlay />
          {isPlaying && (
            <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-white/90 uppercase">CLIPPING</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-16 shrink-0 items-center gap-4 border-t border-white/10 bg-black px-5">
        <button
          onClick={() => setPlaying(!isPlaying)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.25)] transition-transform hover:scale-105"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="2" y="2" width="4" height="10" rx="1" fill="black" />
              <rect x="8" y="2" width="4" height="10" rx="1" fill="black" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 2.5 L12 7 L3 11.5 Z" fill="black" />
            </svg>
          )}
        </button>

        <div className="s-seg">
          {ASPECT_BUTTONS.map((b) => (
            <button
              key={b.key}
              onClick={() => {
                useStudio.getState().setAspect(b.key);
                useStudio.getState().showToast(`${b.key} — ${ASPECTS[b.key].hint}`);
              }}
              className={aspect === b.key ? "active" : ""}
              aria-pressed={aspect === b.key}
            >
              {b.label}
            </button>
          ))}
        </div>

        <span className="font-mono text-xs whitespace-nowrap text-white/60 tabular-nums">
          {fmtClock(playhead)} / {fmtClock(duration)}
        </span>

        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.01}
          value={Math.min(playhead, duration)}
          onChange={(e) => setPlayhead(parseFloat(e.target.value))}
          className="min-w-0 flex-1"
          aria-label="Seek"
        />
      </div>
    </div>
  );
}
