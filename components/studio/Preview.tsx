"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStudio } from "@/store/studio";
import { CaptionOverlay } from "@/components/studio/CaptionOverlay";
import { ASPECTS, fmtClock, type AspectKey } from "@/lib/types";
import { reframeCropAt } from "@/lib/reframe/math";

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
  const reframe = useStudio((s) => s.reframe);
  const showSafeZones = useStudio((s) => s.showSafeZones);

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
  const isVertical = aspect === "9:16";

  // Simulated reframe transform — same math as the export crop.
  const reframeTransform = useMemo(() => {
    if (!reframe.enabled || reframe.scale <= 1) return null;
    const crop = reframeCropAt(playhead, media.width, media.height, ratio, reframe);
    const scaleX = media.width / crop.w;
    const scaleY = media.height / crop.h;
    // translate so the crop window centers in the frame, then scale up.
    const tx = (0.5 - (crop.x + crop.w / 2) / media.width) * media.width;
    const ty = (0.5 - (crop.y + crop.h / 2) / media.height) * media.height;
    return { transform: `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})` };
  }, [reframe, playhead, media.width, media.height, ratio]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-6">
        <div className="studio-grid" aria-hidden />
        <span className="absolute top-4 left-5 z-10 font-mono text-[10px] tracking-[0.3em] text-white/30 uppercase">
          preview
        </span>
        {reframe.status !== "idle" && (
          <span className="absolute top-4 right-5 z-10 rounded-full border border-white/20 bg-black/60 px-3 py-1 font-mono text-[9px] tracking-wider text-white/70 uppercase backdrop-blur">
            {reframe.status === "done" ? "auto-reframe" : reframe.status === "error" ? "center crop" : "tracking…"}
          </span>
        )}
        <div className="relative h-full max-h-full" style={{ aspectRatio: ratio }}>
          {isVertical && (
            <div
              className="pointer-events-none absolute -inset-3 z-10 rounded-[36px] border border-white/15 bg-black/50"
              aria-hidden
            />
          )}
          {isVertical && (
            <div
              className="pointer-events-none absolute -top-1.5 left-1/2 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/25"
              aria-hidden
            />
          )}
          {isVertical && (
            <div className="pointer-events-none absolute top-1/2 -right-3 z-10 flex -translate-y-1/2 flex-col gap-3" aria-hidden>
              <span className="h-7 w-1 rounded-full bg-white/25" />
              <span className="h-12 w-1 rounded-full bg-white/25" />
              <span className="h-7 w-1 rounded-full bg-white/25" />
            </div>
          )}
          <video
            ref={videoRef}
            src={media.url}
            className="h-full w-full rounded-2xl bg-black object-cover shadow-[0_40px_100px_rgba(0,0,0,0.85)] ring-1 ring-white/15"
            style={reframeTransform ?? undefined}
            playsInline
            muted
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" aria-hidden />
          <CaptionOverlay />

          {showSafeZones && (
            <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl" aria-hidden>
              <div className="absolute inset-y-0 right-0 w-[22%] border-l border-dashed border-white/30 bg-white/[0.04]" />
              <div className="absolute right-0 bottom-0 left-0 h-[12%] border-t border-dashed border-white/30 bg-white/[0.04]" />
              <div className="absolute inset-x-0 top-0 h-[10%] border-b border-dashed border-white/30 bg-white/[0.04]" />
              <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[8px] tracking-widest text-white/60 uppercase">
                UI safe zones (TikTok · Reels · Shorts)
              </span>
            </div>
          )}

          {isPlaying && (
            <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-white/90 uppercase">CLIPPING</span>
            </div>
          )}

          {isVertical && (
            <span className="pointer-events-none absolute -bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 font-mono text-[9px] tracking-[0.25em] text-white/50 uppercase backdrop-blur">
              shorts preview
            </span>
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

        <span className="hidden font-mono text-xs whitespace-nowrap text-white/60 tabular-nums md:inline">
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
