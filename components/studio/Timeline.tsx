"use client";

import { useEffect, useMemo, useRef } from "react";
import { WaveformCanvas } from "@/components/studio/WaveformCanvas";
import { usePlayheadRaf } from "@/hooks/usePlayheadRaf";
import { fmtClock } from "@/lib/types";
import { useStudio } from "@/store/studio";

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
  const highlights = useStudio((s) => s.pendingHighlights);
  const captions = useStudio((s) => s.captions);

  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag>(null);
  const stateRef = useRef(useStudio.getState());
  stateRef.current = useStudio.getState();

  const duration = media?.duration || 0;
  const contentWidth = useMemo(() => Math.min(duration * zoom + 240, 40000), [duration, zoom]);

  const bounds = useMemo(() => {
    const set = new Set<number>();
    for (const h of highlights) {
      set.add(h.start);
      set.add(h.end);
    }
    for (const c of clips) {
      set.add(c.start);
      set.add(c.end);
    }
    return [...set].sort((a, b) => a - b);
  }, [highlights, clips]);

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
  const SNAP_PX = 10;
  const snap = (v: number) => {
    const thr = SNAP_PX / zoom;
    let best = v;
    let bestD = thr;
    for (const b of bounds) {
      const d = Math.abs(b - v);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  };

  const beginDrag = (e: React.PointerEvent, clipId: string, mode: DragState["mode"]) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = stateRef.current.clips.find((c) => c.id === clipId);
    if (!clip) return;
    useStudio.getState().commitHistory();
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
        const raw = clamp(d.origStart + delta);
        const byStart = snap(raw);
        const byEnd = snap(raw + len) - len;
        const chosen = Math.abs(byStart - raw) <= Math.abs(byEnd - raw) ? byStart : byEnd;
        let start = clamp(chosen);
        if (start + len > duration) start = Math.max(0, duration - len);
        s.updateClip(d.clipId, { start, end: start + len });
      } else if (d.mode === "trim-start") {
        let start = clamp(snap(d.origStart + delta));
        if (d.origEnd - start < MIN_LEN) start = d.origEnd - MIN_LEN;
        s.updateClip(d.clipId, { start });
      } else {
        let end = clamp(snap(d.origEnd + delta));
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
  for (let t = 0; t <= duration + 1; t += step) ticks.push(t);

  return (
    <div className="studio-timeline flex h-60 min-w-0 shrink-0 flex-col border-t border-white/10 bg-black/80">
      <div className="studio-timeline-toolbar flex min-w-0 items-center gap-3 border-b border-white/10 px-4 py-2">
        <span className="s-display shrink-0 text-sm text-white">Timeline</span>
        <span className="shrink-0 font-mono text-[10px] text-white/45">
          {clips.length} clip{clips.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="font-mono text-[10px] text-white/35">zoom</span>
          <input
            type="range"
            min={30}
            max={320}
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            className="w-32 shrink-0"
            aria-label="Timeline zoom"
          />
          <button
            onClick={() => {
              useStudio.getState().clearTimeline();
              useStudio.getState().showToast("Timeline cleared");
            }}
            className="s-btn shrink-0 px-2.5 py-1 text-[10px]"
          >
            clear
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative min-w-0 flex-1 touch-pan-x overflow-x-auto overflow-y-hidden">
        <div className="relative h-full" style={{ width: contentWidth }}>
          <WaveformCanvas envelope={analysis?.envelope ?? null} zoom={zoom} duration={duration} />
          <div className="absolute top-[54px] right-0 left-0 h-px bg-white/10" aria-hidden />

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
                <span className="h-2 w-px bg-white/25" />
                <span className="ml-1.5 font-mono text-[9px] text-white/35">{fmtClock(t)}</span>
              </div>
            ))}
          </div>

          <div className="absolute top-[55px] bottom-0 left-0" style={{ width: contentWidth }}>
            {captions.length > 0 && <div className="absolute top-0 right-0 left-0 h-7 border-b border-white/10" aria-hidden />}
            {captions.slice(0, 600).map((line) =>
              line.words.map((w, wi) => {
                const left = w.start * zoom;
                const width = Math.max(2, (w.end - w.start) * zoom);
                return (
                  <button
                    key={`${line.id}-${wi}`}
                    title={w.text}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      useStudio.getState().setPlayhead(w.start);
                    }}
                    className="absolute top-1.5 h-3.5 cursor-pointer rounded-sm border border-white/15 bg-white/15 transition-colors hover:border-white/60 hover:bg-white/45"
                    style={{ left, width }}
                    aria-label={`Caption word: ${w.text}`}
                  />
                );
              })
            )}
          </div>

          <div className="absolute top-[86px] bottom-0 left-0" style={{ width: contentWidth }}>
            {clips.map((clip) => {
              const left = clip.start * zoom;
              const width = Math.max(6, (clip.end - clip.start) * zoom);
              const active = clip.id === activeClipId;
              return (
                <div
                  key={clip.id}
                  className={`group absolute top-1 bottom-1 touch-none rounded-lg border transition-shadow ${
                    active
                      ? "border-white bg-white shadow-[0_0_28px_rgba(255,255,255,0.25)]"
                      : "border-white/25 bg-white/10 hover:border-white/60"
                  }`}
                  style={{ left, width }}
                  onPointerDown={(e) => beginDrag(e, clip.id, "move")}
                >
                  <div
                    className={`absolute top-0 bottom-0 -left-1 w-3 cursor-ew-resize rounded-l-md transition-colors ${
                      active ? "bg-black/20" : "bg-transparent group-hover:bg-white/40"
                    }`}
                    onPointerDown={(e) => beginDrag(e, clip.id, "trim-start")}
                    aria-hidden
                  />
                  <div
                    className={`absolute top-0 bottom-0 -right-1 w-3 cursor-ew-resize rounded-r-md transition-colors ${
                      active ? "bg-black/20" : "bg-transparent group-hover:bg-white/40"
                    }`}
                    onPointerDown={(e) => beginDrag(e, clip.id, "trim-end")}
                    aria-hidden
                  />
                  <div className="pointer-events-none flex h-full items-center justify-between px-2.5">
                    <span className={`truncate text-[9px] font-semibold ${active ? "text-black" : "text-white/90"}`} title={clip.label || `${fmtClock(clip.start)} → ${fmtClock(clip.end)}`}>
                      {clip.label || `${fmtClock(clip.start)} → ${fmtClock(clip.end)}`}
                    </span>
                    <span className={`ml-1 shrink-0 font-mono text-[9px] ${active ? "text-black/60" : "text-white/60"}`}>
                      {clip.score?.toFixed(0) ?? ""}
                    </span>
                  </div>
                  {active && (
                    <div className="pointer-events-none absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-black shadow-[0_0_8px_rgba(0,0,0,0.8)]" aria-hidden />
                  )}
                </div>
              );
            })}

            {clips.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="font-mono text-[11px] text-white/30">
                  No clips in timeline — add highlights from the left panel
                </p>
              </div>
            )}
          </div>

          <div
            ref={playheadRef}
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
            style={{ transform: `translateX(${useStudio.getState().playhead * zoom}px)` }}
          >
            <span className="absolute -top-0.5 -left-1.5 h-3 w-3 rounded-sm bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
