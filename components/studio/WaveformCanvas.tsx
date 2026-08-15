"use client";

import { useEffect, useMemo, useRef } from "react";
import { waveformPeaks } from "@/lib/audio";

export function WaveformCanvas({
  envelope,
  zoom,
  duration,
}: {
  envelope: Float32Array | null;
  zoom: number;
  duration: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentWidth = useMemo(() => Math.min(duration * zoom, 40000), [duration, zoom]);
  const bars = Math.min(contentWidth, 12000);
  const peaks = useMemo(
    () => (envelope && envelope.length ? waveformPeaks(envelope, Math.max(1, Math.floor(bars))) : null),
    [envelope, bars]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const h = 48;
    canvas.width = Math.max(1, Math.floor(bars * dpr));
    canvas.height = h * dpr;
    canvas.style.width = `${contentWidth}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, bars, h);
    if (!peaks) return;
    const mid = h / 2;
    const barW = Math.max(1, bars / peaks.length);
    for (let i = 0; i < peaks.length; i++) {
      const v = Math.max(0.02, peaks[i]);
      const bh = Math.max(1, v * (h - 8));
      const x = i * barW;
      ctx.fillStyle = i % 7 === 3 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)";
      ctx.fillRect(x, mid - bh / 2, Math.max(1, barW - 1), bh);
    }
  }, [peaks, bars, contentWidth]);

  return <canvas ref={canvasRef} className="absolute top-0 left-0" aria-hidden />;
}
