"use client";

import { useRef, useState } from "react";
import { useStudio } from "@/store/studio";
import { classifyLink } from "@/lib/linkDetect";
import { importFromLink } from "@/lib/importLink";

export function UploadZone() {
  const ingest = useStudio((s) => s.ingest);
  const analyzing = useStudio((s) => s.analyzing);
  const progress = useStudio((s) => s.analyzeProgress);
  const stage = useStudio((s) => s.analyzeStage);
  const cancelAnalysis = useStudio((s) => s.cancelAnalysis);
  const showToast = useStudio((s) => s.showToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [fileSizeWarn, setFileSizeWarn] = useState(false);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const busy = analyzing || importing;

  const handleImport = async () => {
    const raw = url.trim();
    if (!raw || busy) return;
    if (classifyLink(raw) === "platform") {
      setImportError(
        "Platform pages (YouTube · TikTok · Reels) aren't directly downloadable — paste a direct .mp4/.webm link instead."
      );
      return;
    }
    setImportError(null);
    setImportProgress(0);
    setImporting(true);
    try {
      await importFromLink(raw, (mb) => setImportProgress(mb));
      setUrl("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed — try a different link.");
    } finally {
      setImporting(false);
    }
  };

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      showToast("Drop a video file — mp4, webm, mov, mkv");
      return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setFileSizeWarn(true);
      showToast("Large file — analysis may take a while and use lots of memory");
    }
    void ingest(file);
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-8">
      <div className="studio-grid" aria-hidden />
      <div className="relative z-10 w-full max-w-2xl">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a video"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[32px] border-2 border-dashed px-8 py-20 text-center transition-all duration-300 ${
            drag
              ? "scale-[1.015] border-white/70 bg-white/[0.06] shadow-[0_0_60px_rgba(255,255,255,0.12)]"
              : "border-white/20 bg-white/[0.03]"
          } ${busy ? "cursor-wait" : "cursor-pointer"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,0.25)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="black" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h2 className="s-display text-3xl tracking-tight">
            Drop your long video here
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/50">
            Any format, any length, any resolution. The entire analysis runs{" "}
            <span className="text-white">locally in your browser</span> — nothing is uploaded.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <span className="s-chip">mp4 · webm · mov · mkv</span>
            <span className="s-chip">up to 4K</span>
            <span className="s-chip">zero uploads</span>
          </div>

          {analyzing && (
            <div className="absolute inset-x-0 bottom-0">
              <div className="border-t border-white/10 bg-black/60 px-7 py-4 text-left backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <p className="font-mono text-[11px] text-white/70">
                    {stage || "Analyzing…"} · {Math.round(progress * 100)}%
                  </p>
                  <button
                    onClick={cancelAnalysis}
                    className="rounded-full border border-white/25 px-3 py-1 text-[10px] font-medium text-white/70 transition-colors hover:border-white/60 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="s-display text-sm uppercase tracking-[0.2em] text-white/80">
              Or import from a link
            </h3>
            <span className="s-chip">direct .mp4 · webm · mov</span>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleImport();
            }}
          >
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (importError) setImportError(null);
              }}
              placeholder="https://example.com/video.mp4"
              aria-label="Video link"
              disabled={busy}
              className="h-11 flex-1 rounded-xl border border-white/15 bg-black/40 px-4 font-mono text-xs text-white placeholder-white/30 outline-none transition-colors focus:border-white/60"
            />
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="h-11 rounded-xl bg-white px-5 text-xs font-semibold tracking-wide text-black transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {importing ? "Downloading…" : "Import"}
            </button>
          </form>

          {importing && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="font-mono text-[11px] text-white/70">
                  Downloading video · {Math.round(importProgress)} MB
                </p>
                <p className="font-mono text-[11px] text-white/40">importing</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full animate-pulse rounded-full bg-white" />
              </div>
            </div>
          )}

          {importError && (
            <p className="mt-3 text-[11px] leading-relaxed text-white/60" role="alert">
              {importError}
            </p>
          )}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { k: "10", v: "AI-ranked moments" },
            { k: "0s", v: "upload time" },
            { k: "100%", v: "in-browser" },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center">
              <p className="s-display text-2xl text-white">{s.k}</p>
              <p className="mt-1 text-[11px] text-white/45">{s.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
