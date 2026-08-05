"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStudio } from "@/store/studio";
import { WaveformCanvas } from "@/components/studio/WaveformCanvas";
import { usePlayheadRaf } from "@/hooks/usePlayheadRaf";
import { fmtClock } from "@/lib/types";

type DragState = {
  mode: "trim-start" | "trim-end" | "move";
  clipId: string;
  startX: number;
  origStart: number;
  origEnd: number;
};
type Drag = DragState | null;

const MIN_LEN = 1;

export function Timeline() {
  const media = useStudio((s) => s.media);
  const analysis = useStudio((s) => s.analysis);
  const clips = useStudio((s) => s.clips);
  const activeClipId = useStudio((s) => s.activeClipId);
  const zoom = useStudio((s) => s.zoom);
  const setZoom = useStudio((s) => s.setZoom);

  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag>(null);
  const stateRef = useRef(useStudio.getState());
  stateRef.current = useStudio.getState();

  const duration = media?.duration || 0;
  const contentWidth = useMemo(() => Math.min(duration * zoom + 240, 40000), [duration, zoom]);

  usePlayheadRaf((t) => {
    const el = playheadRef.current;
    if (!el) return;
    el.style.transform = `translateX(${t * zoom}px)`;
    const parent = scrollRef.current;
    if (parent) {
      const pos = t * zoom;
      const left = parent.scrollLeft;
      const right = left + parent.clientWidth;
      if (pos < left + 40) parent.scrollLeft = Math.max(0, pos - 40);
      else if (pos > right - 40) parent.scrollLeft = pos - parent.clientWidth + 40;
    }
  });

  const clamp = (v: number) => Math.min(Math.max(0, v), Math.max(0.01, duration));

  const beginDrag = (e: React.PointerEvent, clipId: string, mode: DragState["mode"]) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = stateRef.current.clips.find((c) => c.id === clipId);
    if (!clip) return;
    dragRef.current = { mode, clipId, startX: e.clientX, origStart: clip.start, origEnd: clip.end };
    useStudio.getState().setActiveClip(clipId);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const px = zoom;
      const delta = (e.clientX - d.startX) / px;
      const s = useStudio.getState();
      if (d.mode === "move") {
        const len = d.origEnd - d.origStart;
        let start = clamp(d.origStart + delta);
        if (start + len > duration) start = Math.max(0, duration - len);
        s.updateClip(d.clipId, { start, end: start + len });
      } else if (d.mode === "trim-start") {
        let start = clamp(d.origStart + delta);
        if (d.origEnd - start < MIN_LEN) start = d.origEnd - MIN_LEN;
        s.updateClip(d.clipId, { start });
      } else {
        let end = clamp(d.origEnd + delta);
        if (end - d.origStart < MIN_LEN) end = d.origStart + MIN_LEN;
        s.updateClip(d.clipId, { end });
      }
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [zoom, duration]);

  if (!media) return null;

  const ticks = [];
  const step = zoom < 40 ? 60 : zoom < 90 ? 30 : zoom < 160 ? 10 : 5;
  for (let t = 0; t <= duration + 1; t += step) {
    ticks.push(t);
  }

  return (
    <div className="flex h-44 shrink-0 flex-col border-t border-line bg-panel/70">
      <div className="flex items-center gap-3 border-b border-line px-4 py-1.5">
        <span className="font-mono text-[10px] tracking-widest text-mute uppercase">Timeline</span>
        <span className="font-mono text-[10px] text-brand2">
          {clips.length} clip{clips.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[10px] text-mute">zoom</span>
          <input
            type="range"
            min={30}
            max={320}
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            className="w-32"
            aria-label="Timeline zoom"
          />
          <button
            onClick={() => {
              useStudio.getState().clearTimeline();
              useStudio.getState().showToast("Timeline cleared");
            }}
            className="rounded-md border border-line px-2.5 py-1 font-mono text-[10px] text-mute transition-colors hover:border-hot/50 hover:text-hot"
          >
            clear
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
        <div className="relative h-full" style={{ width: contentWidth }}>
          <WaveformCanvas envelope={analysis?.envelope ?? null} zoom={zoom} duration={duration} />

          <div className="absolute top-[54px] right-0 left-0 h-px bg-line" aria-hidden />

          <div
            className="absolute top-0 left-0 cursor-crosshair"
            style={{ width: contentWidth, height: 54 }}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              useStudio.getState().setPlayhead(clamp(x / zoom));
            }}
            role="slider"
            aria-label="Timeline ruler"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(useStudio.getState().playhead)}
          >
            {ticks.map((t) => (
              <div key={t} className="absolute top-1.5 flex items-start" style={{ left: t * zoom }}>
                <span className="h-2 w-px bg-white/20" />
                <span className="ml-1.5 font-mono text-[9px] text-mute/70">{fmtClock(t)}</span>
              </div>
            ))}
          </div>

          <div className="absolute top-[56px] bottom-0 left-0" style={{ width: contentWidth }}>
            {clips.map((clip) => {
              const left = clip.start * zoom;
              const width = Math.max(6, (clip.end - clip.start) * zoom);
              const active = clip.id === activeClipId;
              return (
                <div
                  key={clip.id}
                  className={`group absolute top-1 bottom-1 rounded-md border transition-shadow ${
                    active
                      ? "border-brand2/80 bg-gradient-to-r from-brand/30 to-brand2/20 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                      : "border-brand/40 bg-brand/10 hover:border-brand2/50"
                  }`}
                  style={{ left, width }}
                  onPointerDown={(e) => beginDrag(e, clip.id, "move")}
                >
                  <div
                    className="absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize rounded-l-md bg-brand2/0 transition-colors group-hover:bg-brand2/60"
                    onPointerDown={(e) => beginDrag(e, clip.id, "trim-start")}
                    aria-hidden
                  />
                  <div
                    className="absolute top-0 bottom-0 -right-1 w-2 cursor-ew-resize rounded-r-md bg-brand2/0 transition-colors group-hover:bg-brand2/60"
                    onPointerDown={(e) => beginDrag(e, clip.id, "trim-end")}
                    aria-hidden
                  />
                  <div className="pointer-events-none flex h-full items-center justify-between px-2.5">
                    <span className="truncate font-mono text-[9px] font-semibold text-white/90">
                      {fmtClock(clip.start)} → {fmtClock(clip.end)}
                    </span>
                    <span className="font-mono text-[9px] text-brand2">{clip.score}</span>
                  </div>
                  {active && (
                    <div className="pointer-events-none absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-hot shadow-[0_0_8px_#F472B6]" aria-hidden />
                  )}
                </div>
              );
            })}

            {clips.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="font-mono text-[11px] text-mute/60">
                  No clips in timeline — add highlights from the left panel
                </p>
              </div>
            )}
          </div>

          <div
            ref={playheadRef}
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-hot shadow-[0_0_10px_#F472B6]"
            style={{ transform: `translateX(${useStudio.getState().playhead * zoom}px)` }}
          >
            <span className="absolute -top-0.5 -left-1.5 h-3 w-3 rounded-sm bg-hot" />
          </div>
        </div>
      </div>
    </div>
  );
}
