"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/i.test(ua);
}

export function Preview() {
  const media = useStudio((s) => s.media);
  const source = useStudio((s) => s.source);
  const aspect = useStudio((s) => s.aspect);
  const playhead = useStudio((s) => s.playhead);
  const isPlaying = useStudio((s) => s.isPlaying);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const setPlaying = useStudio((s) => s.setPlaying);
  const tick = useStudio((s) => s.tick);
  const reframe = useStudio((s) => s.reframe);
  const showSafeZones = useStudio((s) => s.showSafeZones);
  const toggleSafeZones = useStudio((s) => s.toggleSafeZones);
  const showToast = useStudio((s) => s.showToast);

  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [mobileControls, setMobileControls] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setMobileControls(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media) return;
    setVideoError(null);
    video.pause();

    const safariFilePath = isSafariBrowser() && source && "srcObject" in video;
    if (safariFilePath) {
      try {
        video.removeAttribute("src");
        video.srcObject = source;
        video.load();
      } catch {
        video.srcObject = null;
        video.src = media.url;
        video.load();
      }
    } else {
      video.srcObject = null;
      video.src = media.url;
      video.load();
    }

    return () => {
      try { video.pause(); } catch {}
      try { video.srcObject = null; } catch {}
      video.removeAttribute("src");
    };
  }, [media?.url, source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media) return;
    const sync = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const target = Math.min(playhead, Math.max(0, video.duration - 0.01));
      if (!isPlaying && Math.abs(video.currentTime - target) > 0.03) {
        try { video.currentTime = target; } catch {}
      }
    };
    if (video.readyState >= 1) sync();
    else video.addEventListener("loadedmetadata", sync, { once: true });
    return () => video.removeEventListener("loadedmetadata", sync);
  }, [media?.url, media, playhead, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      const start = async () => {
        try {
          video.muted = false;
          await video.play();
          setVideoError(null);
        } catch (err) {
          setPlaying(false);
          const message = err instanceof DOMException && err.name === "NotAllowedError"
            ? "Tap Play once to allow video and audio playback."
            : "This video could not be played in this browser.";
          setVideoError(message);
          showToast(message);
        }
      };
      void start();
      let frame = 0;
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        if (video.ended || video.currentTime >= (useStudio.getState().media?.duration ?? 0)) {
          setPlaying(false);
          return;
        }
        if (frame % 2 === 0) tick(video.currentTime);
        frame++;
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      video.pause();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick, setPlaying, showToast]);

  if (!media) return null;
  const duration = media.duration || 0;
  const ratio = ASPECTS[aspect].ratio;
  const isVertical = aspect === "9:16";

  const reframeTransform = useMemo(() => {
    if (!reframe.enabled) return null;
    const crop = reframeCropAt(playhead, media.width, media.height, ratio, reframe);
    const scaleX = media.width / crop.w;
    const scaleY = media.height / crop.h;
    const tx = (0.5 - (crop.x + crop.w / 2) / media.width) * media.width;
    const ty = (0.5 - (crop.y + crop.h / 2) / media.height) * media.height;
    return {
      transform: `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`,
      transformOrigin: "center center",
    };
  }, [reframe, playhead, media.width, media.height, ratio]);

  const handleVideoError = () => {
    const code = videoRef.current?.error?.code;
    const message = code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ? "This browser cannot decode this video format. Try MP4 (H.264/AAC) for the widest mobile support."
      : "The video could not be loaded. Try importing it again.";
    setVideoError(message);
    setPlaying(false);
  };

  return (
    <div className="studio-preview flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="studio-preview-stage relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-black p-3 sm:p-6">
        <div className="studio-grid" aria-hidden />
        <span className="absolute top-4 left-5 z-10 font-mono text-[10px] tracking-[0.3em] text-white/30 uppercase">preview</span>
        {reframe.status !== "idle" && <span className="absolute top-4 right-5 z-10 rounded-full border border-white/20 bg-black/60 px-3 py-1 font-mono text-[9px] tracking-wider text-white/70 uppercase backdrop-blur">{reframe.status === "done" ? "auto-reframe" : reframe.status === "error" ? "center crop" : "tracking…"}</span>}
        <div className="relative flex h-full max-h-full min-h-0 max-w-full items-center justify-center" style={{ aspectRatio: ratio }}>
          {isVertical && <div className="pointer-events-none absolute -inset-3 z-10 rounded-[36px] border border-white/15 bg-black/50" aria-hidden />}
          {isVertical && <div className="pointer-events-none absolute -top-1.5 left-1/2 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/25" aria-hidden />}
          {isVertical && <div className="pointer-events-none absolute top-1/2 -right-3 z-10 flex -translate-y-1/2 flex-col gap-3" aria-hidden><span className="h-7 w-1 rounded-full bg-white/25" /><span className="h-12 w-1 rounded-full bg-white/25" /><span className="h-7 w-1 rounded-full bg-white/25" /></div>}
          <video
            key={media.url}
            ref={videoRef}
            className="h-full w-full rounded-2xl bg-black object-contain shadow-[0_40px_100px_rgba(0,0,0,0.85)] ring-1 ring-white/15"
            style={reframeTransform ?? undefined}
            playsInline
            controls={mobileControls}
            preload="auto"
            onLoadedMetadata={() => setVideoError(null)}
            onCanPlay={() => setVideoError(null)}
            onError={handleVideoError}
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" aria-hidden />
          <CaptionOverlay />
          {videoError && <div className="absolute inset-x-3 bottom-3 z-30 rounded-2xl border border-white/15 bg-black/85 p-3 text-center backdrop-blur"><p className="text-[11px] leading-relaxed text-white/75">{videoError}</p><button type="button" onClick={() => { setVideoError(null); const v = videoRef.current; if (v) { if (isSafariBrowser() && source && "srcObject" in v) v.srcObject = source; else v.src = media.url; v.load(); } }} className="mt-2 rounded-full border border-white/25 px-3 py-1.5 text-[10px] text-white/80">Retry video</button></div>}
          {showSafeZones && <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl" aria-hidden><div className="absolute inset-y-0 right-0 w-[22%] border-l border-dashed border-white/30 bg-white/[0.04]" /><div className="absolute right-0 bottom-0 left-0 h-[12%] border-t border-dashed border-white/30 bg-white/[0.04]" /><div className="absolute inset-x-0 top-0 h-[10%] border-b border-dashed border-white/30 bg-white/[0.04]" /><span className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[8px] tracking-widest text-white/60 uppercase">UI safe zones (TikTok · Reels · Shorts)</span></div>}
          {isPlaying && <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" /><span className="font-mono text-[10px] tracking-[0.25em] text-white/90 uppercase">CLIPPING</span></div>}
          {isVertical && <span className="pointer-events-none absolute -bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 font-mono text-[9px] tracking-[0.25em] text-white/50 uppercase backdrop-blur">shorts preview</span>}
        </div>
      </div>

      <div className="studio-preview-controls flex min-h-16 shrink-0 items-center gap-2 overflow-x-auto border-t border-white/10 bg-black px-3 sm:h-16 sm:gap-4 sm:px-5">
        <button onClick={() => setPlaying(!isPlaying)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.25)] transition-transform hover:scale-105" aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden><rect x="2" y="2" width="4" height="10" rx="1" fill="black" /><rect x="8" y="2" width="4" height="10" rx="1" fill="black" /></svg> : <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 2.5 L12 7 L3 11.5 Z" fill="black" /></svg>}
        </button>
        <div className="s-seg shrink-0">{ASPECT_BUTTONS.map((b) => <button key={b.key} onClick={() => { useStudio.getState().setAspect(b.key); useStudio.getState().showToast(`${b.key} — ${ASPECTS[b.key].hint}`); }} className={aspect === b.key ? "active" : ""} aria-pressed={aspect === b.key}>{b.label}</button>)}</div>
        <button
          type="button"
          onClick={() => { toggleSafeZones(); showToast(showSafeZones ? "Safe zones hidden" : "Safe zones shown"); }}
          className={`s-btn shrink-0 px-2.5 py-1.5 text-[10px] ${showSafeZones ? "bg-white text-black" : ""}`}
          aria-pressed={showSafeZones}
        >
          Safe zones
        </button>
        <span className="hidden shrink-0 font-mono text-xs whitespace-nowrap text-white/60 md:inline">{fmtClock(playhead)} / {fmtClock(duration)}</span>
        <input type="range" min={0} max={Math.max(0.1, duration)} step={0.01} value={Math.min(playhead, duration)} onChange={(e) => setPlayhead(parseFloat(e.target.value))} className="min-w-[90px] flex-1" aria-label="Seek" />
      </div>
    </div>
  );
}
