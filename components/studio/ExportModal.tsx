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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Export your clips"
    >
      <div
        className="glass-deep w-full max-w-md rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Export</h2>
          <button
            onClick={close}
            disabled={busy}
            className="rounded-full px-2.5 py-1 text-mute transition-colors hover:text-fg disabled:opacity-40"
            aria-label="Close export dialog"
          >
            ×
          </button>
        </div>

        {exportState === "done" && resultUrl ? (
          <div className="mt-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand2/15">
              <span className="text-xl text-brand2">✓</span>
            </div>
            <p className="text-sm text-fg">Export ready</p>
            <p className="mt-1 font-mono text-[11px] text-mute">{doneName}</p>
            <a
              href={resultUrl}
              download={doneName}
              className="btn-primary mt-5 block rounded-full px-6 py-3 text-center text-sm font-semibold text-white"
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
              className="mt-3 text-xs text-mute hover:text-fg"
            >
              Export something else
            </button>
          </div>
        ) : exportState === "error" ? (
          <div className="mt-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-hot/15">
              <span className="text-xl text-hot">!</span>
            </div>
            <p className="text-sm font-medium text-fg">Export failed</p>
            <p className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-line bg-ink p-3 text-left font-mono text-[10px] leading-relaxed break-words text-mute">
              {error}
            </p>
            <button
              onClick={() => {
                useStudio.getState().setExportState("idle", 0, null);
                setError("");
              }}
              className="mt-4 rounded-full border border-line px-5 py-2 text-xs text-mute hover:text-fg"
            >
              Back to options
            </button>
          </div>
        ) : busy ? (
          <div className="mt-6">
            <p className="text-sm text-mute">
              {exportState === "loading"
                ? "Booting ffmpeg.wasm engine…"
                : `Encoding in your browser… ${Math.round(exportProgress * 100)}%`}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand via-brand2 to-hot transition-all duration-200"
                style={{ width: `${Math.round(exportProgress * 100)}%` }}
              />
            </div>
            <p className="mt-3 font-mono text-[10px] text-mute">
              {media?.name} · {segCount} segment{segCount === 1 ? "" : "s"} · local encode — nothing uploaded
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <p className="mb-2 font-mono text-[10px] tracking-widest text-mute uppercase">Scope</p>
              <div className="flex gap-2">
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
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
                      scope === k
                        ? "border-brand2/70 bg-brand2/10 text-brand2"
                        : "border-line bg-panel text-mute hover:text-fg"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {clips.length === 0 && (
                <p className="mt-1.5 text-[10px] text-mute/70">
                  No clips yet — the full video will export as one segment.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-2 font-mono text-[10px] tracking-widest text-mute uppercase">Format</p>
                <div className="flex gap-2">
                  {(["mp4", "webm"] as ExportFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 font-mono text-xs ${
                        format === f
                          ? "border-brand2/70 bg-brand2/10 text-brand2"
                          : "border-line bg-panel text-mute"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-mono text-[10px] tracking-widest text-mute uppercase">Quality</p>
                <div className="flex gap-2">
                  {([720, 1080] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 font-mono text-xs ${
                        resolution === r
                          ? "border-brand2/70 bg-brand2/10 text-brand2"
                          : "border-line bg-panel text-mute"
                      }`}
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
                  className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-xs text-mute hover:text-fg"
                  role="switch"
                  aria-checked={val}
                >
                  <span>{label}</span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      val ? "bg-brand2/60" : "bg-line"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        val ? "left-4.5" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3">
              <span className="font-mono text-[10px] text-mute">Aspect</span>
              <span className="font-mono text-xs text-brand2">{aspect}</span>
              <span className="ml-auto font-mono text-[10px] text-mute/60">burned at {resolution}p</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={downloadSrt}
                className="rounded-full border border-line px-5 py-3 text-xs text-mute transition-colors hover:text-fg"
              >
                SRT only
              </button>
              <button
                onClick={() => void run()}
                className="btn-primary flex-1 rounded-full py-3 text-sm font-semibold text-white"
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
