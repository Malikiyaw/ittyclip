"use client";

import { useRef, useState } from "react";
import { useStudio } from "@/store/studio";

export function UploadZone() {
  const ingest = useStudio((s) => s.ingest);
  const analyzing = useStudio((s) => s.analyzing);
  const progress = useStudio((s) => s.analyzeProgress);
  const showToast = useStudio((s) => s.showToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      showToast("Drop a video file — mp4, webm, mov, mkv");
      return;
    }
    void ingest(file);
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a video"
          onClick={() => !analyzing && inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
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
          className={`glass relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-8 py-20 text-center transition-all duration-300 ${
            drag ? "scale-[1.015] border-brand2 ring-glow" : "border-line"
          } ${analyzing ? "cursor-wait" : "cursor-pointer"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-hot shadow-[0_0_50px_rgba(124,92,255,0.5)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h2 className="font-display text-2xl font-bold">
            Drop your long video here
          </h2>
          <p className="mt-2 max-w-sm text-sm text-mute">
            Any format, any length, any resolution. The entire analysis runs{" "}
            <span className="text-brand2">locally in your browser</span> — nothing is uploaded.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="chip">mp4 · webm · mov · mkv</span>
            <span className="chip">up to 4K</span>
            <span className="chip">zero uploads</span>
          </div>

          {analyzing && (
            <div className="absolute inset-x-0 bottom-0">
              <div className="bg-panel/80 px-6 py-3 text-left">
                <p className="mb-2 font-mono text-[11px] text-brand2">
                  {progress < 0.35
                    ? "Decoding audio…"
                    : progress < 0.6
                      ? "Mapping energy envelope…"
                      : progress < 0.85
                        ? "Detecting silence & speech bursts…"
                        : "Scoring highlight moments…"}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-brand2 transition-all duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { k: "6", v: "AI highlight moments" },
            { k: "97", v: "caption languages" },
            { k: "0s", v: "upload time" },
          ].map((s) => (
            <div key={s.v} className="glass rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-gradient">{s.k}</p>
              <p className="mt-0.5 text-[11px] text-mute">{s.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
