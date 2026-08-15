"use client";

import { useRef, useState } from "react";
import { useStudio } from "@/store/studio";
import { importFromLink } from "@/lib/importLink";
import { ANALYSIS_STAGES, MAX_LOCAL_ANALYSIS_BYTES } from "@/lib/audio";

const SAMPLE_VIDEO_URL = "https://media.w3.org/2010/05/sintel/trailer.mp4";
const MAX_MB = Math.round(MAX_LOCAL_ANALYSIS_BYTES / 1024 / 1024);
const STEPS = ANALYSIS_STAGES.map(([, label]) => label) as string[];
function analysisStepIndex(progress: number): number { let idx = 0; for (let i = 0; i < ANALYSIS_STAGES.length; i++) if (progress >= (ANALYSIS_STAGES[i][0] as number) - 0.0001) idx = i; return idx; }

export function UploadZone() {
  const ingest = useStudio((s) => s.ingest), analyzing = useStudio((s) => s.analyzing), progress = useStudio((s) => s.analyzeProgress), stage = useStudio((s) => s.analyzeStage), cancelAnalysis = useStudio((s) => s.cancelAnalysis), showToast = useStudio((s) => s.showToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false), [fileSizeWarn, setFileSizeWarn] = useState(false), [url, setUrl] = useState(""), [importing, setImporting] = useState(false), [resolving, setResolving] = useState(false), [importProgress, setImportProgress] = useState(0), [importError, setImportError] = useState<string | null>(null);
  const busy = analyzing || importing;

  const handleImport = async (rawUrl?: string) => {
    const raw = (rawUrl ?? url).trim(); if (!raw || busy) return;
    setImportError(null); setImportProgress(0); setResolving(true); setImporting(true);
    try { await importFromLink(raw, (mb) => { setResolving(false); setImportProgress(mb); }); setUrl(""); }
    catch (err) { setResolving(false); setImportError(err instanceof Error ? err.message : "Import failed — try a different link."); }
    finally { setImporting(false); }
  };
  const trySample = () => { if (busy) return; setUrl(SAMPLE_VIDEO_URL); void handleImport(SAMPLE_VIDEO_URL); };
  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) { showToast("Drop a video file — mp4, webm, mov, mkv"); return; }
    setFileSizeWarn(file.size > MAX_LOCAL_ANALYSIS_BYTES);
    if (file.size > MAX_LOCAL_ANALYSIS_BYTES) showToast(`This video is over ${MAX_MB} MB. It will open for manual editing without automatic analysis, keeping mobile Safari stable.`);
    void ingest(file);
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-8">
      <div className="studio-grid" aria-hidden />
      <div className="relative z-10 w-full max-w-2xl">
        <div role="button" tabIndex={0} aria-label="Upload a video" onClick={() => !busy && inputRef.current?.click()} onKeyDown={(e) => e.key === "Enter" && !busy && inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }} className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[32px] border-2 border-dashed px-8 py-20 text-center transition-all duration-300 ${drag ? "scale-[1.015] border-white/70 bg-white/[0.06] shadow-[0_0_60px_rgba(255,255,255,0.12)]" : "border-white/20 bg-white/[0.03]"} ${busy ? "cursor-wait" : "cursor-pointer"}`}>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,0.25)]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="black" strokeWidth="2" strokeLinecap="round" /></svg></div>
          <h2 className="s-display text-3xl tracking-tight">Drop your long video here</h2>
          <p className="mt-3 max-w-sm text-sm text-white/50">Any format, any length, any resolution. Analysis is performed locally in your browser when your device can safely handle it.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2"><span className="s-chip">mp4 · webm · mov · mkv</span><span className="s-chip">up to 4K</span><span className="s-chip">zero uploads</span></div>
          <button onClick={trySample} disabled={busy} className="mt-5 rounded-full border border-white/20 px-4 py-2 text-[11px] font-medium text-white/60 transition-colors hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">No video handy? Try the sample →</button>
          {fileSizeWarn && !analyzing && <p className="mt-4 max-w-md text-[11px] leading-relaxed text-white/50">Automatic analysis is limited to {MAX_MB} MB on this browser to prevent memory-related page restarts. The video can still be opened and edited manually.</p>}
          {analyzing && <div className="absolute inset-x-0 bottom-0"><div className="border-t border-white/10 bg-black/70 px-7 py-4 text-left backdrop-blur"><div className="mb-2 flex items-center justify-between gap-4"><p className="font-mono text-[11px] tracking-wide text-white/80 uppercase">{stage || "Preparing"} · {Math.round(progress * 100)}%</p><button onClick={cancelAnalysis} className="rounded-full border border-white/25 px-3 py-1 text-[10px] font-medium text-white/70 transition-colors hover:border-white/60 hover:text-white">Cancel</button></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="relative h-full overflow-hidden rounded-full bg-white transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }}><span className="absolute inset-0 animate-pulse-soft bg-gradient-to-r from-transparent via-white/70 to-transparent" /></div></div><ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">{STEPS.map((label, i) => { const stepIdx = analysisStepIndex(progress), done = i < stepIdx, active = i === stepIdx; return <li key={label} className={`flex items-center gap-1.5 text-[10px] ${done ? "text-white/80" : active ? "text-white/60" : "text-white/30"}`}>{done ? <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-white text-[8px] font-bold text-black">✓</span> : active ? <span className="h-3.5 w-3.5 shrink-0 animate-pulse rounded-full border border-white/50" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/15" />}{label}</li>; })}</ol></div></div>}
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="s-display text-sm uppercase tracking-[0.2em] text-white/80">Or import from a link</h3><span className="s-chip">YouTube · TikTok · Reels · Shorts</span></div><form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void handleImport(); }}><input type="url" value={url} onChange={(e) => { setUrl(e.target.value); if (importError) setImportError(null); }} placeholder="Paste a link — YouTube, TikTok, Reels, or direct .mp4" aria-label="Video link" disabled={busy} className="h-11 flex-1 rounded-xl border border-white/15 bg-black/40 px-4 font-mono text-xs text-white placeholder-white/30 outline-none transition-colors focus:border-white/60" /><button type="submit" disabled={busy || !url.trim()} className="h-11 rounded-xl bg-white px-5 text-xs font-semibold tracking-wide text-black transition-opacity hover:opacity-85 disabled:opacity-40">{importing ? "Importing…" : "Import"}</button></form>{importing && <div className="mt-4"><div className="mb-1.5 flex items-center justify-between"><p className="font-mono text-[11px] text-white/70">{resolving ? "Resolving link…" : `Downloading video · ${Math.round(importProgress)} MB`}</p><p className="font-mono text-[11px] text-white/40">{resolving ? "resolving" : "downloading"}</p></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full animate-pulse rounded-full bg-white" /></div></div>}{importError && <p className="mt-3 text-[11px] leading-relaxed text-white/60" role="alert">{importError}</p>}</div>
        <div className="mt-8 grid grid-cols-3 gap-4">{[{ k: "10", v: "AI-ranked moments" }, { k: "0s", v: "upload time" }, { k: "100%", v: "in-browser" }].map((s) => <div key={s.v} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center"><p className="s-display text-2xl text-white">{s.k}</p><p className="mt-1 text-[11px] text-white/45">{s.v}</p></div>)}</div>
      </div>
    </div>
  );
}
