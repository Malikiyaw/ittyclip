"use client";

import { useMemo, useState } from "react";
import { useStudio } from "@/store/studio";
import { uid, type CaptionLine, type CaptionStyleKey } from "@/lib/types";
import { aiHeaders } from "@/lib/ai/settings";

interface CaptionSegment { start: number; end: number; text: string; emphasis?: string[] }

async function callPhase3(operation: "caption-intelligence" | "caption-style", context: unknown) {
  const response = await fetch("/api/ai/phase3", { method: "POST", headers: aiHeaders(), body: JSON.stringify({ operation, context }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "AI request failed");
  return data as { value: { segments?: CaptionSegment[]; style?: CaptionStyleKey; reason?: string; animation?: "none" | "pop" | "fade" | "slide-up" | "word-pop" } };
}

export function AICaptionTools() {
  const media = useStudio((s) => s.media);
  const captions = useStudio((s) => s.captions);
  const activeClipId = useStudio((s) => s.activeClipId);
  const clips = useStudio((s) => s.clips);
  const setCaptions = useStudio((s) => s.setCaptions);
  const setCaptionStyle = useStudio((s) => s.setCaptionStyle);
  const updateCaptionSettings = useStudio((s) => s.updateCaptionSettings);
  const showToast = useStudio((s) => s.showToast);
  const [busy, setBusy] = useState<"captions" | "style" | null>(null);
  const [styleResult, setStyleResult] = useState<{ style: CaptionStyleKey; reason: string; animation: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeClip = useMemo(() => clips.find((c) => c.id === activeClipId) ?? null, [clips, activeClipId]);
  const context = useMemo(() => ({
    duration: media?.duration ?? 0,
    transcript: captions.map((c) => ({ start: c.start, end: c.end, text: c.text })),
    selectedClip: activeClip ? { start: activeClip.start, end: activeClip.end } : undefined,
  }), [media?.duration, captions, activeClip]);

  const runCaptions = async () => {
    if (!media || captions.length === 0) { showToast("Transcribe the video first"); return; }
    setBusy("captions"); setError(null);
    try {
      const result = await callPhase3("caption-intelligence", context);
      const segments = result.value.segments ?? [];
      if (!segments.length) throw new Error("AI returned no usable caption segments");
      const lines: CaptionLine[] = segments.map((segment) => {
        const words = segment.text.split(/\s+/).filter(Boolean);
        const span = Math.max(0.05, segment.end - segment.start);
        return {
          id: uid(), start: segment.start, end: segment.end, text: segment.text,
          words: words.map((word, i) => ({ text: word, start: segment.start + span * (i / words.length), end: segment.start + span * ((i + 1) / words.length) })),
        };
      });
      setCaptions(lines);
      showToast(`AI optimized ${lines.length} caption lines`);
    } catch (e) { setError(e instanceof Error ? e.message : "AI caption optimization failed"); }
    finally { setBusy(null); }
  };

  const runStyle = async () => {
    if (!media || captions.length === 0) { showToast("Transcribe the video first"); return; }
    setBusy("style"); setError(null);
    try {
      const result = await callPhase3("caption-style", context);
      const value = result.value;
      if (!value.style) throw new Error("AI returned no style");
      setStyleResult({ style: value.style, reason: value.reason ?? "", animation: value.animation ?? "none" });
    } catch (e) { setError(e instanceof Error ? e.message : "AI style recommendation failed"); }
    finally { setBusy(null); }
  };

  const applyStyle = () => {
    if (!styleResult) return;
    setCaptionStyle(styleResult.style);
    updateCaptionSettings({ animation: styleResult.animation as "none" | "pop" | "fade" | "slide-up" | "word-pop" });
    showToast(`AI applied ${styleResult.style} caption style`);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="s-label">AI Caption Studio</p>
          <p className="mt-1 text-[10px] text-white/40">Real AI analysis · grounded in your transcript</p>
        </div>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[8px] font-mono text-white/45">PHASE 3</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={runCaptions} disabled={busy !== null || captions.length === 0} className="rounded-xl bg-white px-3 py-2.5 text-[10px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">
          {busy === "captions" ? "Optimizing…" : "✨ Optimize captions"}
        </button>
        <button onClick={runStyle} disabled={busy !== null || captions.length === 0} className="rounded-xl border border-white/20 bg-white/[0.05] px-3 py-2.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {busy === "style" ? "Analyzing…" : "🎨 Auto Style"}
        </button>
      </div>
      {styleResult && (
        <div className="mt-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-white">{styleResult.style}</p>
              <p className="mt-0.5 text-[9px] text-white/45">Animation: {styleResult.animation}</p>
            </div>
            <button onClick={applyStyle} className="rounded-full bg-white px-3 py-1.5 text-[9px] font-semibold text-black">Apply</button>
          </div>
          {styleResult.reason && <p className="mt-2 text-[10px] leading-relaxed text-white/50">{styleResult.reason}</p>}
        </div>
      )}
      {error && <p className="mt-2 rounded-lg border border-red-300/15 bg-red-300/5 p-2 text-[9px] leading-relaxed text-red-200/75">{error}</p>}
    </div>
  );
}
