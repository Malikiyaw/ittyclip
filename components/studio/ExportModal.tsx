"use client";

import { useState } from "react";
import { useStudio } from "@/store/studio";
import { buildSrt } from "@/lib/captions";
import type { ExportFormat } from "@/lib/types";

export function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const media = useStudio((s) => s.media);
  const clips = useStudio((s) => s.clips);
  const captions = useStudio((s) => s.captions);
  const activeClipId = useStudio((s) => s.activeClipId);
  const aspect = useStudio((s) => s.aspect);
  const exportState = useStudio((s) => s.exportState);
  const exportProgress = useStudio((s) => s.exportProgress);
  const exportResultUrl = useStudio((s) => s.exportResultUrl);
  const setExportState = useStudio((s) => s.setExportState);
  const showToast = useStudio((s) => s.showToast);

  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [resolution, setResolution] = useState<720 | 1080>(1080);
  const [burn, setBurn] = useState(true);
  const [watermark, setWatermark] = useState(true);
  const [scope, setScope] = useState<"all" | "active">("all");
  const [doneName, setDoneName] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const busy = exportState === "loading" || exportState === "running";
  const resultUrl = exportResultUrl;
  const segCount = clips.length || 1;

  const downloadSrt = () => {
    const blob = new Blob([buildSrt(captions)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ittyclip-captions.srt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const run = async () => {
    setError("");
    const s = useStudio.getState();
    const source = s.source;
    if (!source || !s.media) {
      showToast("Upload a video first");
      return;
    }
    const segments =
      s.clips.length > 0
        ? (scope === "active"
            ? s.clips.filter((c) => c.id === s.activeClipId)
            : s.clips
          ).map((c) => ({ start: c.start, end: c.end }))
        : [{ start: 0, end: s.media.duration }];

    s.setExportState("loading", 0.02, null);
    try {
      const { exportVideo, supportsBrowserEncoding } = await import("@/lib/ffmpeg");
      if (!supportsBrowserEncoding()) {
        throw new Error(
          "In-browser encoding needs SharedArrayBuffer. Open ittyclip in Chrome, Edge, or Firefox (not Safari, or enable site isolation flags)."
        );
      }
      const { blob, name } = await exportVideo(source, {
        segments,
        captions: burn ? s.captions : [],
        aspect: s.aspect,
        format,
        resolution,
        burnCaptions: burn,
        watermark,
        onProgress: (p) => s.setExportState("running", p, null),
      });
      const url = URL.createObjectURL(blob);
      s.setExportState("done", 1, url);
      setDoneName(name);
      showToast("Export ready");
    } catch (err) {
      s.setExportState("error", 0, null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const close = () => {
    if (busy) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Export your clips"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 text-black shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="s-display text-xl text-black">Export</h2>
          <button
            onClick={close}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] text-black/50 transition-colors hover:bg-black/10 hover:text-black disabled:opacity-40"
            aria-label="Close export dialog"
          >
            ×
          </button>
        </div>

        {exportState === "done" && resultUrl ? (
          <div className="mt-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-black/10">
              <span className="text-xl text-black">✓</span>
            </div>
            <p className="text-sm font-medium text-black">Export ready</p>
            <p className="mt-1 font-mono text-[11px] text-black/50">{doneName}</p>
            <a
              href={resultUrl}
              download={doneName}
              className="mt-5 block rounded-full bg-black px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-black/80"
            >
              Download clip
            </a>
            <button
              onClick={() => {
                const s = useStudio.getState();
                if (s.exportResultUrl) URL.revokeObjectURL(s.exportResultUrl);
                s.setExportState("idle", 0, null);
                setDoneName("");
              }}
              className="mt-3 text-xs text-black/50 hover:text-black"
            >
              Export something else
            </button>
          </div>
        ) : exportState === "error" ? (
          <div className="mt-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#d64545]/10">
              <span className="text-xl text-[#d64545]">!</span>
            </div>
            <p className="text-sm font-medium text-black">Export failed</p>
            <p className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-black/10 bg-black/[0.04] p-3 text-left font-mono text-[10px] leading-relaxed break-words text-black/60">
              {error}
            </p>
            <button
              onClick={() => {
                useStudio.getState().setExportState("idle", 0, null);
                setError("");
              }}
              className="mt-4 rounded-full border border-black/15 px-5 py-2 text-xs text-black/60 transition-colors hover:border-black/40 hover:text-black"
            >
              Back to options
            </button>
          </div>
        ) : busy ? (
          <div className="mt-6">
            <p className="text-sm text-black/60">
              {exportState === "loading"
                ? "Booting ffmpeg.wasm engine…"
                : `Encoding in your browser… ${Math.round(exportProgress * 100)}%`}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-black transition-all duration-200"
                style={{ width: `${Math.round(exportProgress * 100)}%` }}
              />
            </div>
            <p className="mt-3 font-mono text-[10px] text-black/40">
              {media?.name} · {segCount} segment{segCount === 1 ? "" : "s"} · local encode — nothing uploaded
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <p className="s-label mb-2 text-black/40">Scope</p>
              <div className="s-seg-light">
                {(
                  [
                    ["all", `${clips.length} clip${clips.length === 1 ? "" : "s"} in timeline`],
                    ["active", "Active clip only"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setScope(k)}
                    disabled={clips.length === 0}
                    className={scope === k ? "active" : ""}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {clips.length === 0 && (
                <p className="mt-1.5 text-[10px] text-black/40">
                  No clips yet — the full video will export as one segment.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="s-label mb-2 text-black/40">Format</p>
                <div className="s-seg-light">
                  {(["mp4", "webm"] as ExportFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={format === f ? "active" : ""}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="s-label mb-2 text-black/40">Quality</p>
                <div className="s-seg-light">
                  {([720, 1080] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      className={resolution === r ? "active" : ""}
                    >
                      {r}p
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {(
                [
                  ["burn", burn, setBurn, "Burn captions into the video"],
                  ["wm", watermark, setWatermark, "Add ittyclip watermark"],
                ] as const
              ).map(([key, val, setter, label]) => (
                <button
                  key={key}
                  onClick={() => setter(!val)}
                  className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-xs text-black/70 transition-colors hover:border-black/25 hover:text-black"
                  role="switch"
                  aria-checked={val}
                >
                  <span>{label}</span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      val ? "bg-black" : "bg-black/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        val ? "left-4.5" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3">
              <span className="font-mono text-[10px] text-black/50">Aspect</span>
              <span className="font-mono text-xs font-semibold text-black">{aspect}</span>
              <span className="ml-auto font-mono text-[10px] text-black/40">burned at {resolution}p</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={downloadSrt}
                className="rounded-full border border-black/15 px-5 py-3 text-xs text-black/60 transition-colors hover:border-black/40 hover:text-black"
              >
                SRT only
              </button>
              <button
                onClick={() => void run()}
                className="flex-1 rounded-full bg-black py-3 text-sm font-semibold text-white transition-colors hover:bg-black/80"
              >
                Run export
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
