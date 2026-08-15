"use client";

import { useEffect, useMemo, useState } from "react";
import { useStudio } from "@/store/studio";
import { aiHooks, buildSrt, makeLines } from "@/lib/captions";
import { CAPTION_STYLES, fmtClock, type CaptionStyleKey } from "@/lib/types";
import { WHISPER_MODELS, type WhisperModelKey } from "@/lib/whisper";
import { extractThumb } from "@/lib/thumbnails";

type Tab = "highlights" | "captions" | "styles";

const STYLE_SAMPLE: Record<CaptionStyleKey, string> = {
  classic: "bg-black/70 rounded px-2.5 py-1 text-white",
  pop: "text-white font-bold [text-shadow:0_1px_0_#F472B6,0_2px_0_#7C5CFF]",
  karaoke: "text-white font-bold",
  neon: "text-[#B9F6FF] font-semibold [text-shadow:0_0_8px_#22D3EE,0_0_20px_#7C5CFF]",
  minimal: "text-white uppercase tracking-[0.25em] text-[10px]",
  bold: "bg-gradient-to-r from-brand to-hot px-2.5 py-1 text-white font-black rounded",
};

function HighlightsTab() {
  const pending = useStudio((s) => s.pendingHighlights);
  const clips = useStudio((s) => s.clips);
  const addClip = useStudio((s) => s.addClip);
  const addAll = useStudio((s) => s.addAllHighlights);
  const showToast = useStudio((s) => s.showToast);
  const media = useStudio((s) => s.media);
  const aspect = useStudio((s) => s.aspect);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!media || pending.length === 0) return;
    let alive = true;
    pending.forEach((m) => {
      extractThumb({ url: media.url, time: m.start + 0.25, aspect })
        .then((dataUrl) => {
          if (alive) setThumbs((t) => ({ ...t, [m.id]: dataUrl }));
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, [media, aspect, pending]);

  const inTimeline = useMemo(() => new Set(clips.map((c) => c.start.toFixed(3))), [clips]);

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between px-1">
        <p className="s-label">
          Engine found {pending.length}
        </p>
        <button
          onClick={addAll}
          disabled={pending.length === 0}
          className="s-btn-solid px-3 py-1.5 text-[11px]"
        >
          + Add all
        </button>
      </div>

      {pending.length === 0 && (
        <p className="mt-6 text-center text-xs text-white/40">No highlights yet — drop a video to scan.</p>
      )}

      {pending.map((m) => {
        const added = inTimeline.has(m.start.toFixed(3));
        return (
          <div
            key={m.id}
            className={`overflow-hidden rounded-2xl border transition-colors ${
              added ? "border-white/25 bg-white/[0.06]" : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="relative aspect-video w-full bg-black">
              {thumbs[m.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbs[m.id]} alt={m.label} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-[10px] text-white/25">
                  frame…
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="s-badge absolute top-2 right-2 backdrop-blur">
                {m.score}%
              </span>
              <span className="absolute bottom-2 left-2 truncate pr-2 text-xs font-semibold text-white drop-shadow">
                {m.label}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5">
              <span className="font-mono text-[10px] text-white/45">
                {fmtClock(m.start)} → {fmtClock(m.end)} · {(m.end - m.start).toFixed(1)}s
              </span>
              <button
                onClick={() => {
                  if (added) return;
                  addClip(m);
                  showToast("Clip added to timeline");
                }}
                disabled={added}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  added
                    ? "bg-white/5 text-white/30"
                    : "bg-white text-black hover:bg-white/85"
                }`}
              >
                {added ? "In timeline" : "Add"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TranscribePanel() {
  const transcribing = useStudio((s) => s.transcribing);
  const stage = useStudio((s) => s.transcribeStage);
  const progress = useStudio((s) => s.transcribeProgress);
  const model = useStudio((s) => s.transcribeModel);
  const setModel = useStudio((s) => s.setTranscribeModel);
  const transcribe = useStudio((s) => s.transcribe);
  const media = useStudio((s) => s.media);
  const captions = useStudio((s) => s.captions);
  const showToast = useStudio((s) => s.showToast);
  const [cached, setCached] = useState<Partial<Record<WhisperModelKey, boolean>>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!("caches" in window)) return;
      try {
        const cache = await caches.open("whisper.node.wasm.models");
        const urls = new Set((await cache.keys()).map((k) => k.url));
        const next: Partial<Record<WhisperModelKey, boolean>> = {};
        for (const key of Object.keys(WHISPER_MODELS) as WhisperModelKey[]) {
          next[key] = urls.has(WHISPER_MODELS[key].url);
        }
        if (alive) setCached(next);
      } catch {
        /* Cache API unavailable */
      }
    })();
    return () => {
      alive = false;
    };
  }, [transcribing]);

  const busy = transcribing;
  const stageLabel =
    stage === "model" ? "Downloading model…" : stage === "running" ? "Transcribing…" : "";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between">
        <p className="s-label">
          Auto-transcribe · whisper.cpp
        </p>
        <span className="s-chip px-2 py-0.5 text-[9px]">
          100% in-browser
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {(Object.keys(WHISPER_MODELS) as WhisperModelKey[]).map((key) => {
          const info = WHISPER_MODELS[key];
          const active = model === key;
          return (
            <button
              key={key}
              onClick={() => setModel(key)}
              className={`rounded-xl border p-2 text-left transition-colors ${
                active
                  ? "border-white/60 bg-white/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/30"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-white">{info.label}</span>
                {cached[key] && <span className="text-[9px] text-white/60">● cached</span>}
              </div>
              <span className="font-mono text-[9px] text-white/40">
                {info.size} · {info.hint}
              </span>
            </button>
          );
        })}
      </div>

      {busy ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-white/45">
            {stageLabel} {Math.round(progress * 100)}%
          </p>
        </div>
      ) : (
        <button
          onClick={() => {
            if (!media) {
              showToast("Upload a video first");
              return;
            }
            transcribe().catch(() => {});
          }}
          disabled={!media || (captions.length > 0 && stage === "done")}
          className={`mt-3 w-full rounded-full px-3 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
            captions.length > 0 && stage === "done"
              ? "border border-white/20 text-white/50 hover:text-white"
              : "bg-white text-black hover:bg-white/85"
          }`}
        >
          {captions.length > 0 && stage === "done"
            ? "Re-transcribe (replaces captions)"
            : "Transcribe this video"}
        </button>
      )}
    </div>
  );
}

function CaptionsTab() {
  const captions = useStudio((s) => s.captions);
  const playhead = useStudio((s) => s.playhead);
  const makeFromText = useStudio((s) => s.makeCaptionsFromText);
  const addAt = useStudio((s) => s.addCaptionAt);
  const updateCaption = useStudio((s) => s.updateCaption);
  const removeCaption = useStudio((s) => s.removeCaption);
  const showCaptions = useStudio((s) => s.showCaptions);
  const toggleCaptions = useStudio((s) => s.toggleCaptions);
  const showToast = useStudio((s) => s.showToast);
  const [draft, setDraft] = useState("");

  const hooks = useMemo(() => aiHooks(captions[0]?.text ?? ""), [captions]);

  const rebuildWords = (text: string, start: number, end: number) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const total = Math.max(0.1, end - start);
    const sum = words.reduce((acc, w) => acc + Math.max(1, w.length), 1);
    let t = start;
    return words.map((w) => {
      const dur = (Math.max(1, w.length) / sum) * total;
      const word = { text: w, start: t, end: t + dur };
      t += dur;
      return word;
    });
  };

  const downloadSrt = () => {
    const blob = new Blob([buildSrt(captions)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ittyclip-captions.srt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("SRT downloaded");
  };

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      <TranscribePanel />

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="s-label mb-2">
          Paste transcript → auto-timed
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Paste your transcript here. ittyclip will time every line to your audio…"
          className="s-input resize-none"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              if (!draft.trim()) return;
              makeFromText(draft);
              showToast("Captions timed to audio");
            }}
            className="flex-1 rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-black hover:bg-white/85"
          >
            Time it
          </button>
          <button
            onClick={() => {
              const words = "it took me three years to realize the secret".split(" ");
              const lines = makeLines(words, 12);
              useStudio.getState().setCaptions(lines);
              showToast("Sample captions added");
            }}
            className="s-btn px-3 py-2 text-[11px]"
          >
            Sample
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="s-label mb-2">AI Hooks (from your words)</p>
        <div className="flex flex-wrap gap-1.5">
          {hooks.map((h) => (
            <button
              key={h}
              onClick={() => {
                navigator.clipboard?.writeText(h).catch(() => {});
                showToast("Hook copied");
              }}
              className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="s-label">
          {captions.length} lines
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              addAt();
              showToast("Caption at playhead");
            }}
            className="s-btn px-3 py-1 text-[11px]"
          >
            + at {fmtClock(playhead)}
          </button>
          <button
            onClick={toggleCaptions}
            className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
              showCaptions
                ? "border-white/60 bg-white/10 text-white"
                : "border-white/20 text-white/50 hover:text-white"
            }`}
          >
            {showCaptions ? "Visible" : "Hidden"}
          </button>
          <button
            onClick={downloadSrt}
            className="s-btn px-3 py-1 text-[11px]"
          >
            SRT
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {captions.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-white/45">{fmtClock(c.start)}</span>
              <span className="text-white/20">—</span>
              <span className="font-mono text-[9px] text-white/45">{fmtClock(c.end)}</span>
              <button
                onClick={() => removeCaption(c.id)}
                className="ml-auto rounded px-1.5 text-xs text-white/30 transition-colors hover:text-white"
                aria-label="Delete caption"
              >
                ×
              </button>
            </div>
            <input
              value={c.text}
              onChange={(e) =>
                updateCaption(c.id, {
                  text: e.target.value,
                  words: rebuildWords(e.target.value, c.start, c.end),
                })
              }
              className="s-input mt-1.5"
            />
            <div className="mt-1.5 flex gap-2">
              <input
                type="number"
                step={0.1}
                min={0}
                value={Number(c.start.toFixed(1))}
                onChange={(e) => updateCaption(c.id, { start: parseFloat(e.target.value) || 0 })}
                className="s-input w-20 px-2 py-1 font-mono text-[10px] text-white/60"
                aria-label="Caption start time"
              />
              <input
                type="number"
                step={0.1}
                min={0}
                value={Number(c.end.toFixed(1))}
                onChange={(e) => updateCaption(c.id, { end: parseFloat(e.target.value) || 0 })}
                className="s-input w-20 px-2 py-1 font-mono text-[10px] text-white/60"
                aria-label="Caption end time"
              />
            </div>
          </div>
        ))}
        {captions.length === 0 && (
          <p className="text-center text-xs text-white/40">
            No captions yet. Transcribe above, or paste a transcript.
          </p>
        )}
      </div>
    </div>
  );
}

function StylesTab() {
  const style = useStudio((s) => s.captionStyle);
  const setStyle = useStudio((s) => s.setCaptionStyle);
  const showToast = useStudio((s) => s.showToast);

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="s-label px-1">Caption styles</p>
      {CAPTION_STYLES.map((s) => (
        <button
          key={s.key}
          onClick={() => {
            setStyle(s.key);
            showToast(`Style: ${s.label}`);
          }}
          className={`rounded-2xl border p-3 text-left transition-all ${
            style === s.key
              ? "border-white/70 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.08)]"
              : "border-white/10 bg-white/[0.04] hover:border-white/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">{s.label}</span>
            {style === s.key && <span className="text-white">✓</span>}
          </div>
          <p className={`mt-2 font-display text-sm ${STYLE_SAMPLE[s.key]}`}>this is the moment</p>
        </button>
      ))}
      <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-white/40">
        Styles render live on the preview and are burned into the export at the same size you see here.
      </p>
    </div>
  );
}

export function MediaPanel() {
  const [tab, setTab] = useState<Tab>("highlights");

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-black/40">
      <div className="s-seg mx-3 mt-3">
        {(
          [
            ["highlights", "Highlights"],
            ["captions", "Captions"],
            ["styles", "Styles"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? "active" : ""}
            aria-pressed={tab === key}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "highlights" && <HighlightsTab />}
        {tab === "captions" && <CaptionsTab />}
        {tab === "styles" && <StylesTab />}
      </div>
    </aside>
  );
}
