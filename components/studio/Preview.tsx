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
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#05060c] p-4">
        <div
          className="grid-bg absolute inset-0 opacity-50"
          aria-hidden
        />
        <div className="relative h-full max-h-full" style={{ aspectRatio: ratio }}>
          <video
            ref={videoRef}
            src={media.url}
            className="h-full w-full rounded-xl bg-black object-cover shadow-[0_30px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
            playsInline
            muted
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10" aria-hidden />
          <CaptionOverlay />
          {isPlaying && (
            <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-hot" />
              <span className="font-mono text-[10px] tracking-widest text-white">CLIPPING</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-16 shrink-0 items-center gap-4 border-t border-line bg-panel/60 px-5">
        <button
          onClick={() => setPlaying(!isPlaying)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand2 shadow-[0_0_20px_rgba(124,92,255,0.5)] transition-transform hover:scale-105"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="2" y="2" width="4" height="10" rx="1" fill="white" />
              <rect x="8" y="2" width="4" height="10" rx="1" fill="white" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 2.5 L12 7 L3 11.5 Z" fill="white" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {ASPECT_BUTTONS.map((b) => (
            <button
              key={b.key}
              onClick={() => {
                useStudio.getState().setAspect(b.key);
                useStudio.getState().showToast(`${b.key} — ${ASPECTS[b.key].hint}`);
              }}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                aspect === b.key ? "bg-brand/20 text-brand2" : "text-mute hover:text-fg"
              }`}
              aria-pressed={aspect === b.key}
            >
              {b.label}
            </button>
          ))}
        </div>

        <span className="font-mono text-xs text-mute">
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
