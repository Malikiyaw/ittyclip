"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/store/studio";
import { aiHooks, buildSrt, makeLines } from "@/lib/captions";
import { CLIP_LENGTHS, fmtClock, type CaptionAnimation, type CaptionSettings, type ClipLength } from "@/lib/types";
import { CAPTION_STYLES } from "@/lib/types";
import type { RankedHighlight } from "@/lib/analysis/types";
import { WHISPER_MODELS, type WhisperModelKey } from "@/lib/whisper";
import { extractThumb } from "@/lib/thumbnails";
import { contentIntelligence } from "@/lib/content";
import { REFRAME_SCALE_MAX, REFRAME_SCALE_MIN } from "@/lib/reframe/state";
import { AiSettingsPanel } from "@/components/studio/AiSettingsPanel";

type Tab = "ai" | "edit" | "captions" | "reframe" | "export";

const BREAKDOWN_LABELS: { key: keyof RankedHighlight["breakdown"]; label: string }[] = [
  { key: "speech", label: "speech" },
  { key: "energy", label: "energy" },
  { key: "pacing", label: "pacing" },
  { key: "silence", label: "silence" },
  { key: "quotability", label: "quotes" },
  { key: "completeness", label: "clean" },
  { key: "boundary", label: "cut" },
];

function BreakdownBars({ breakdown }: { breakdown: RankedHighlight["breakdown"] }) {
  return (
    <div className="flex items-end gap-[3px]" aria-hidden>
      {BREAKDOWN_LABELS.map(({ key, label }) => (
        <div key={key} className="flex flex-1 flex-col items-center gap-0.5">
          <div className="h-7 w-full overflow-hidden rounded-sm bg-white/10">
            <div className="h-full w-full bg-white/80" style={{ height: `${breakdown[key]}%` }} />
          </div>
          <span className="text-[7px] leading-none text-white/35">{label}</span>
        </div>
      ))}
    </div>
  );
}

function HighlightCard({ m, rank, autoThumb = true }: { m: RankedHighlight; rank: number; autoThumb?: boolean }) {
  const addClip = useStudio((s) => s.addClip);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const setPlaying = useStudio((s) => s.setPlaying);
  const showToast = useStudio((s) => s.showToast);
  const clips = useStudio((s) => s.clips);
  const media = useStudio((s) => s.media);
  const aspect = useStudio((s) => s.aspect);
  const analyzing = useStudio((s) => s.analyzing);
  const [thumb, setThumb] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadThumb = useCallback(() => {
    if (!media || loadingRef.current) return;
    loadingRef.current = true;
    extractThumb({ url: media.url, time: m.start + 0.25, aspect })
      .then((dataUrl) => setThumb(dataUrl))
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
      });
  }, [media, aspect, m.start]);

  useEffect(() => {
    if (!media || analyzing || !autoThumb) return;
    loadThumb();
  }, [media, analyzing, autoThumb, m.start, m.id, loadThumb]);

  const added = useMemo(
    () => clips.some((c) => Math.abs(c.start - m.start) < 0.05 && Math.abs(c.end - m.end) < 0.05),
    [clips, m.start, m.end]
  );

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-colors ${
        rank === 1
          ? "border-white/50 bg-white/[0.08] shadow-[0_0_30px_rgba(255,255,255,0.08)]"
          : added
            ? "border-white/25 bg-white/[0.06]"
            : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="relative aspect-video w-full bg-black">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={m.label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 font-mono text-[10px] text-white/25">
            <span>frame…</span>
            {!autoThumb && (
              <button
                type="button"
                onClick={loadThumb}
                className="rounded-full border border-white/20 px-2.5 py-1 text-[9px] text-white/50 transition-colors hover:border-white/50 hover:text-white"
              >
                Load thumbnail
              </button>
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <span className="absolute top-2 left-2 rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-black shadow">
          #{m.rank}
        </span>
        <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] font-semibold text-white backdrop-blur">
          {m.score}
          <span className="text-white/50">/100</span>
        </span>
        <div className="absolute right-2 bottom-2 left-2 flex items-center gap-1.5">
          <span className="truncate rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
            {m.reason.emoji} {m.reason.label}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-mono text-white/80 backdrop-blur">
            {m.source === "ai" ? "AI" : "LOCAL"}
          </span>
        </div>
      </div>

      {m.transcript && (
        <p className="line-clamp-2 px-3 pt-2.5 text-[11px] leading-relaxed text-white/70">
          “{m.transcript}”
        </p>
      )}

      <div className="px-3 pt-2">
        <BreakdownBars breakdown={m.breakdown} />
      </div>

      <div className="flex items-center justify-between gap-2 p-2.5">
        <span className="font-mono text-[10px] text-white/45">
          {fmtClock(m.start)} → {fmtClock(m.end)} · {(m.end - m.start).toFixed(1)}s
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setPlayhead(m.start);
              setPlaying(true);
              showToast(`Previewing #${m.rank}`);
            }}
            className="rounded-full border border-white/25 px-2.5 py-1.5 text-[10px] font-medium text-white/80 transition-colors hover:border-white/60 hover:text-white"
          >
            Preview
          </button>
          <button
            onClick={() => {
              if (added) return;
              addClip(m);
              showToast("Clip added to timeline");
            }}
            disabled={added}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-40 ${
              added ? "bg-white/5 text-white/40" : "bg-white text-black hover:bg-white/85"
            }`}
          >
            {added ? "In timeline" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function whyThisClip(m: RankedHighlight): string {
  const signals: string[] = [];
  if (m.breakdown.speech >= 55) signals.push("clear speech");
  if (m.breakdown.energy >= 55) signals.push("high energy");
  if (m.breakdown.pacing >= 55) signals.push("fast pacing");
  if (m.breakdown.quotability >= 55) signals.push("a quotable line");
  const len = (m.end - m.start).toFixed(0);
  if (signals.length === 0) {
    return `The top-ranked moment in your video — a ${len}s window worth shipping as-is.`;
  }
  const base = `This is the strongest-ranked window: ${signals.join(", ")} over ${len}s`;
  if (m.transcript) {
    const quote = m.transcript.length > 64 ? m.transcript.slice(0, 64) + "…" : m.transcript;
    return `${base}, opening on “${quote}”.`;
  }
  return `${base}.`;
}

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, score) / 100) * c;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-white">
        {score}
      </span>
    </div>
  );
}

function HeroHighlightCard({
  m,
  onMakeShort,
}: {
  m: RankedHighlight;
  onMakeShort: () => void;
}) {
  const media = useStudio((s) => s.media);
  const aspect = useStudio((s) => s.aspect);
  const addClip = useStudio((s) => s.addClip);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const setPlaying = useStudio((s) => s.setPlaying);
  const showToast = useStudio((s) => s.showToast);
  const clips = useStudio((s) => s.clips);
  const analyzing = useStudio((s) => s.analyzing);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!media || analyzing) return;
    let alive = true;
    extractThumb({ url: media.url, time: m.start + 0.25, aspect })
      .then((dataUrl) => {
        if (alive) setThumb(dataUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [media, analyzing, aspect, m.start, m.id]);

  const added = useMemo(
    () => clips.some((c) => Math.abs(c.start - m.start) < 0.05 && Math.abs(c.end - m.end) < 0.05),
    [clips, m.start, m.end]
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/[0.09] shadow-[0_0_40px_rgba(255,255,255,0.12)]">
      <div className="relative aspect-video w-full bg-black">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={m.label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[10px] text-white/25">
            frame…
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
        <span className="absolute top-2 left-2 rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-black shadow">
          #1 BEST MOMENT
        </span>
        <div className="absolute top-2 right-2 rounded-2xl bg-black/60 p-1.5 backdrop-blur">
          <ScoreRing score={m.score} />
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <span className="truncate rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
            {m.reason.emoji} {m.reason.label}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-mono text-white/80 backdrop-blur">
            {m.source === "ai" ? "AI" : "LOCAL"}
          </span>
          <span className="ml-auto font-mono text-[10px] whitespace-nowrap text-white/45">
            {fmtClock(m.start)} → {fmtClock(m.end)} · {(m.end - m.start).toFixed(1)}s
          </span>
        </div>

        {m.transcript && (
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-white/80">
            “{m.transcript}”
          </p>
        )}

        <div className="mt-2.5 rounded-xl border border-white/10 bg-black/40 p-2.5">
          <p className="s-label">Why this clip</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/60">{whyThisClip(m)}</p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={onMakeShort}
            className="col-span-2 rounded-full bg-white px-3 py-2.5 text-[11px] font-bold text-black transition-colors hover:bg-white/85"
          >
            ⚡ Make this a Short
          </button>
          <button
            onClick={() => {
              setPlayhead(m.start);
              setPlaying(true);
              showToast(`Previewing #${m.rank}`);
            }}
            className="rounded-full border border-white/25 px-3 py-2.5 text-[11px] font-medium text-white/80 transition-colors hover:border-white/60 hover:text-white"
          >
            Preview
          </button>
        </div>
        <button
          onClick={() => {
            if (added) return;
            addClip(m);
            showToast("Clip added to timeline");
          }}
          disabled={added}
          className={`mt-2 w-full rounded-full px-3 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
            added ? "bg-white/5 text-white/40" : "border border-white/25 text-white/80 hover:bg-white/10"
          }`}
        >
          {added ? "In timeline" : "Add to timeline"}
        </button>
      </div>
    </div>
  );
}

function ContentIntelligencePanel() {
  const captions = useStudio((s) => s.captions);
  const showToast = useStudio((s) => s.showToast);
  const ci = useMemo(() => (captions.length > 0 ? contentIntelligence(captions) : null), [captions]);

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    showToast(`${label} copied`);
  };

  if (!ci) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="s-label">Content intelligence</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
          Transcribe the video and ittyclip builds a title, hook, description and hashtags from your actual
          words — ready to paste into the platform.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between">
        <p className="s-label">Content intelligence</p>
        <span className="rounded-full border border-white/20 px-2 py-0.5 font-mono text-[8px] tracking-wider text-white/50 uppercase">
          from your words
        </span>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        {(
          [
            ["Title", ci.title],
            ["Hook", ci.hook],
            ["Category", ci.category],
          ] as const
        ).map(([label, value]) => (
          <button
            key={label}
            onClick={() => copy(value, label)}
            className="group flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left transition-colors hover:border-white/30"
          >
            <span className="w-16 shrink-0 font-mono text-[9px] tracking-wider text-white/40 uppercase">
              {label}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-white/80">{value}</span>
            <span className="text-[9px] text-white/30 group-hover:text-white/70">copy</span>
          </button>
        ))}
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <p className="font-mono text-[9px] tracking-wider text-white/40 uppercase">Description</p>
          <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-white/70">{ci.description}</p>
          <button onClick={() => copy(ci.description, "Description")} className="mt-1.5 text-[9px] text-white/30 hover:text-white/70">
            copy
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ci.hashtags.map((tag) => (
            <button
              key={tag}
              onClick={() => copy(`#${tag}`, "Hashtag")}
              className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/15"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AITab({ onExport }: { onExport: () => void }) {
  const pending = useStudio((s) => s.pendingHighlights);
  const clipLength = useStudio((s) => s.clipLength);
  const setClipLength = useStudio((s) => s.setClipLength);
  const source = useStudio((s) => s.highlightSource);
  const generateTop = useStudio((s) => s.generateTopClips);
  const showToast = useStudio((s) => s.showToast);
  const captions = useStudio((s) => s.captions);
  const aiAnalyzing = useStudio((s) => s.aiAnalyzing);
  const aiProgress = useStudio((s) => s.aiProgress);
  const aiStage = useStudio((s) => s.aiStage);
  const aiFailed = useStudio((s) => s.aiFailed);
  const analyzeWithAI = useStudio((s) => s.analyzeWithAI);
  const media = useStudio((s) => s.media);
  const makeShort = useStudio((s) => s.makeShort);

  const canAI = captions.length > 0 && !aiAnalyzing;
  const hero = pending[0] ?? null;
  const rest = pending.slice(1);

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <AiSettingsPanel />

      {hero && (
        <HeroHighlightCard
          m={hero}
          onMakeShort={() => {
            makeShort(hero.id);
            onExport();
          }}
        />
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="flex items-center justify-between">
          <p className="s-label">
            Clip length
          </p>
          <span className="font-mono text-[10px] text-white/50">
            {pending.length} ranked
          </span>
        </div>
        <div className="s-seg mt-2">
          {CLIP_LENGTHS.map((len: ClipLength) => (
            <button
              key={len}
              onClick={() => {
                if (len === clipLength) return;
                setClipLength(len);
              }}
              className={clipLength === len ? "active" : ""}
              aria-pressed={clipLength === len}
            >
              {len}s
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="s-label">
          {source === "ai" ? "AI ranked" : "Ranked"}
          <span
            className={`ml-2 rounded-full px-2 py-0.5 font-mono text-[9px] ${
              source === "ai" ? "bg-white text-black" : "bg-white/10 text-white/60"
            }`}
          >
            {source === "ai" ? "AI" : "LOCAL"}
          </span>
        </p>
        <button
          onClick={generateTop}
          disabled={pending.length === 0}
          className="s-btn-solid px-3 py-1.5 text-[11px]"
        >
          ⚡ Generate Top {Math.min(10, pending.length) || 10}
        </button>
      </div>

      {media && (
        <button
          onClick={() => {
            if (!canAI) {
              if (captions.length === 0) showToast("Transcribe the video first — AI needs the transcript");
              return;
            }
            void analyzeWithAI();
          }}
          disabled={!canAI}
          className="w-full rounded-full border border-white/30 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {aiAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" />
              {aiStage || "Connecting to AI…"} {Math.round(aiProgress * 100)}%
            </span>
          ) : aiFailed ? (
            "Retry AI analysis"
          ) : captions.length === 0 ? (
            "AI analysis — needs a transcript first"
          ) : (
            "✨ Analyze with AI"
          )}
        </button>
      )}

      <ContentIntelligencePanel />

      {pending.length === 0 && (
        <p className="mt-6 text-center text-xs leading-relaxed text-white/40">
          {media
            ? "No highlights generated — the local analysis engine couldn't run in this browser. Clip manually with the A key, or try the AI engine below."
            : "No highlights yet — drop a video to scan."}
        </p>
      )}

      {rest.map((m) => (
        <HighlightCard key={m.id} m={m} rank={m.rank} autoThumb={m.rank <= 3} />
      ))}
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
  const commitHistory = useStudio((s) => s.commitHistory);
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
              onBlur={() => commitHistory()}
              className="s-input mt-1.5"
            />
            <div className="mt-1.5 flex gap-2">
              <input
                type="number"
                step={0.1}
                min={0}
                value={Number(c.start.toFixed(1))}
                onChange={(e) => updateCaption(c.id, { start: parseFloat(e.target.value) || 0 })}
                onBlur={() => commitHistory()}
                className="s-input w-20 px-2 py-1 font-mono text-[10px] text-white/60"
                aria-label="Caption start time"
              />
              <input
                type="number"
                step={0.1}
                min={0}
                value={Number(c.end.toFixed(1))}
                onChange={(e) => updateCaption(c.id, { end: parseFloat(e.target.value) || 0 })}
                onBlur={() => commitHistory()}
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

      <div className="border-t border-white/10 pt-1">
        <StylesTab />
      </div>
    </div>
  );
}

const FONT_OPTIONS: { value: CaptionSettings["font"]; label: string }[] = [
  { value: "display", label: "Archivo Black" },
  { value: "sans", label: "Inter" },
];
const WEIGHT_OPTIONS: { value: CaptionSettings["weight"]; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
  { value: "black", label: "Black" },
];
const POSITION_OPTIONS: { value: CaptionSettings["position"]; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];
const BACKGROUND_OPTIONS: { value: CaptionSettings["background"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "soft", label: "Soft" },
];
const ANIMATION_OPTIONS: { value: CaptionAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pop", label: "Pop" },
  { value: "fade", label: "Fade" },
  { value: "slide-up", label: "Slide up" },
  { value: "word-pop", label: "Word highlight" },
];

function StylesTab() {
  const style = useStudio((s) => s.captionStyle);
  const setStyle = useStudio((s) => s.setCaptionStyle);
  const settings = useStudio((s) => s.captionSettings);
  const updateSettings = useStudio((s) => s.updateCaptionSettings);
  const commitHistory = useStudio((s) => s.commitHistory);
  const showToast = useStudio((s) => s.showToast);
  const [advanced, setAdvanced] = useState(false);

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
          <p
            className="mt-2 text-sm leading-snug"
            style={{
              fontFamily: settings.font === "display" ? "Archivo Black, sans-serif" : "Inter, sans-serif",
              fontWeight: settings.weight,
              fontSize: `${0.9 * settings.size}rem`,
              color: settings.textColor,
              textTransform: settings.uppercase ? "uppercase" : "none",
            }}
          >
            this is the moment
          </p>
        </button>
      ))}

      <button
        onClick={() => setAdvanced(!advanced)}
        className="s-btn w-full py-1.5 text-[11px]"
        aria-expanded={advanced}
      >
        {advanced ? "Hide advanced settings" : "Advanced settings"}
      </button>

      {advanced && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div>
            <p className="s-label mb-1.5">Font</p>
            <div className="s-seg">
              {FONT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    updateSettings({ font: o.value });
                    commitHistory();
                  }}
                  className={settings.font === o.value ? "active" : ""}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="s-label mb-1.5">Weight</p>
            <div className="s-seg">
              {WEIGHT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    updateSettings({ weight: o.value });
                    commitHistory();
                  }}
                  className={settings.weight === o.value ? "active" : ""}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="s-label mb-1.5">Position</p>
            <div className="s-seg">
              {POSITION_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    updateSettings({ position: o.value });
                    commitHistory();
                  }}
                  className={settings.position === o.value ? "active" : ""}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="s-label mb-1.5">Background</p>
            <div className="s-seg">
              {BACKGROUND_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    updateSettings({ background: o.value });
                    commitHistory();
                  }}
                  className={settings.background === o.value ? "active" : ""}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="s-label mb-1.5">Animation</p>
            <div className="s-seg">
              {ANIMATION_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    updateSettings({ animation: o.value });
                    commitHistory();
                  }}
                  className={settings.animation === o.value ? "active" : ""}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-2 text-xs text-white/70">
            <span>Font size</span>
            <input
              type="range"
              min={0.7}
              max={1.6}
              step={0.05}
              value={settings.size}
              onChange={(e) => updateSettings({ size: parseFloat(e.target.value) })}
              onPointerUp={() => commitHistory()}
              onKeyUp={() => commitHistory()}
              className="w-40"
              aria-label="Caption font size"
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-xs text-white/70">
            <span>Line spacing</span>
            <input
              type="range"
              min={0.9}
              max={1.7}
              step={0.05}
              value={settings.lineSpacing}
              onChange={(e) => updateSettings({ lineSpacing: parseFloat(e.target.value) })}
              onPointerUp={() => commitHistory()}
              onKeyUp={() => commitHistory()}
              className="w-40"
              aria-label="Caption line spacing"
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-xs text-white/70">
            <span>Max width</span>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.02}
              value={settings.maxWidth}
              onChange={(e) => updateSettings({ maxWidth: parseFloat(e.target.value) })}
              onPointerUp={() => commitHistory()}
              onKeyUp={() => commitHistory()}
              className="w-40"
              aria-label="Caption max width"
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-xs text-white/70">
            <span>Text color</span>
            <input
              type="color"
              value={settings.textColor}
              onChange={(e) => updateSettings({ textColor: e.target.value })}
              onBlur={() => commitHistory()}
              className="h-7 w-14 cursor-pointer rounded border border-white/20 bg-transparent"
              aria-label="Caption text color"
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-xs text-white/70">
            <span>Highlight color</span>
            <input
              type="color"
              value={settings.highlightColor}
              onChange={(e) => updateSettings({ highlightColor: e.target.value })}
              onBlur={() => commitHistory()}
              className="h-7 w-14 cursor-pointer rounded border border-white/20 bg-transparent"
              aria-label="Caption highlight color"
            />
          </label>

          {(["stroke", "shadow", "uppercase"] as const).map((key) => (
            <button
              key={key}
              onClick={() => {
                updateSettings({ [key]: !settings[key] } as Partial<CaptionSettings>);
                commitHistory();
              }}
              className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
              role="switch"
              aria-checked={settings[key]}
            >
              <span className="capitalize">{key}</span>
              <span
                className={`relative h-4.5 w-8 rounded-full transition-colors ${
                  settings[key] ? "bg-white" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                    settings[key] ? "left-4 bg-black" : "left-0.5 bg-white"
                  }`}
                />
              </span>
            </button>
          ))}

          {settings.background !== "none" && (
            <label className="flex items-center justify-between gap-2 text-xs text-white/70">
              <span>Background opacity</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={settings.backgroundOpacity}
                onChange={(e) => updateSettings({ backgroundOpacity: parseFloat(e.target.value) })}
                onPointerUp={() => commitHistory()}
                onKeyUp={() => commitHistory()}
                className="w-40"
                aria-label="Caption background opacity"
              />
            </label>
          )}

          <button
            onClick={() => {
              updateSettings({});
              setStyle("pop");
              commitHistory();
              showToast("Settings reset to Pop");
            }}
            className="s-btn w-full py-1.5 text-[11px]"
          >
            Reset to defaults
          </button>
        </div>
      )}

      <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-white/40">
        Styles render live on the preview and are burned into the export at the same size you see here.
        Per-word highlight colors stay preview-only — exports burn solid highlight blocks.
      </p>
    </div>
  );
}

function ReframeTab() {
  const media = useStudio((s) => s.media);
  const reframe = useStudio((s) => s.reframe);
  const updateReframe = useStudio((s) => s.updateReframe);
  const commitReframe = useStudio((s) => s.commitReframe);
  const showToast = useStudio((s) => s.showToast);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startTracking = async () => {
    if (!media || running) return;
    setRunning(true);
    setProgress(0);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const { trackSubject } = await import("@/lib/reframe/track");
      const track = await trackSubject(media.url, media.duration, {
        onStatus: (stage) => updateReframe({ status: stage }),
        onProgress: (f) => setProgress(f),
        signal: abort.signal,
      });
      if (!track || track.length < 2) {
        setError("Couldn't detect a face — switching to center crop. You can still adjust it manually.");
        updateReframe({ enabled: true, mode: "center", status: "error", track: null });
        return;
      }
      updateReframe({ enabled: true, mode: "tracked", track, status: "done" });
      commitReframe();
      showToast("Auto-reframe tracked — preview simulates the camera move");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateReframe({ status: "idle" });
        showToast("Face tracking cancelled");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      updateReframe({ enabled: true, mode: "center", status: "error", track: null });
      showToast("Face tracking unavailable — using center crop");
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const cancelTracking = () => {
    abortRef.current?.abort();
  };

  const statusLabel =
    reframe.status === "detecting"
      ? "Detecting subject…"
      : reframe.status === "tracking"
        ? `Tracking subject… ${progress !== null ? Math.round(progress * 100) + "%" : ""}`
        : reframe.status === "done"
          ? "Tracked — preview mirrors the export"
          : reframe.status === "error"
            ? "Center crop fallback"
            : "Off";

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between">
          <p className="s-label">Auto-reframe</p>
          <span className="font-mono text-[10px] text-white/50">{statusLabel}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          Tracks the speaker and pans/zooms so the face stays centered in
          {reframe.mode === "tracked" ? " every frame" : " the frame"} — the way pro editors shoot it.
        </p>
        <button
          onClick={() => {
            if (running) return;
            if (reframe.enabled) {
              updateReframe({ enabled: false, status: "idle" });
              commitReframe();
              showToast("Auto-reframe off");
              return;
            }
            void startTracking();
          }}
          disabled={running}
          className={`mt-3 w-full rounded-full px-3 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            reframe.enabled
              ? "border border-white/30 text-white hover:bg-white/10"
              : "bg-white text-black hover:bg-white/85"
          }`}
        >
          {running
            ? "Analyzing frames…"
            : reframe.enabled
              ? "Disable auto-reframe"
              : "Auto-reframe this video"}
        </button>
        {running && progress !== null && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
        {running && (
          <button
            onClick={cancelTracking}
            className="mt-2 w-full rounded-full border border-white/15 px-3 py-1.5 text-[10px] text-white/60 transition-colors hover:border-white/40 hover:text-white"
          >
            Cancel tracking
          </button>
        )}
        {reframe.enabled && reframe.mode === "tracked" && (
          <button
            onClick={() => {
              updateReframe({ mode: "center", track: null, status: "idle" });
              commitReframe();
              showToast("Switched to manual center crop");
            }}
            className="mt-2 w-full rounded-full border border-white/15 px-3 py-1.5 text-[10px] text-white/60 transition-colors hover:border-white/40 hover:text-white"
          >
            Switch to manual center crop
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="s-label mb-2">Manual controls</p>
        <label className="mb-2 block text-xs text-white/70">
          Horizontal position
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={reframe.offsetX}
            onChange={(e) => updateReframe({ offsetX: parseFloat(e.target.value) })}
            onPointerUp={() => commitReframe()}
            onKeyUp={() => commitReframe()}
            className="mt-1.5 w-full"
            aria-label="Reframe horizontal position"
          />
        </label>
        <label className="mb-2 block text-xs text-white/70">
          Vertical position
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={reframe.offsetY}
            onChange={(e) => updateReframe({ offsetY: parseFloat(e.target.value) })}
            onPointerUp={() => commitReframe()}
            onKeyUp={() => commitReframe()}
            className="mt-1.5 w-full"
            aria-label="Reframe vertical position"
          />
        </label>
        <label className="block text-xs text-white/70">
          Zoom {reframe.scale.toFixed(2)}×
          <input
            type="range"
            min={REFRAME_SCALE_MIN}
            max={REFRAME_SCALE_MAX}
            step={0.01}
            value={reframe.scale}
            onChange={(e) => updateReframe({ scale: parseFloat(e.target.value) })}
            onPointerUp={() => commitReframe()}
            onKeyUp={() => commitReframe()}
            className="mt-1.5 w-full"
            aria-label="Reframe zoom"
          />
        </label>
        <button
          onClick={() => {
            updateReframe({ offsetX: 0, offsetY: 0, scale: 1 });
            commitReframe();
            showToast("Reframe reset");
          }}
          className="s-btn mt-2 w-full py-1.5 text-[11px]"
        >
          Reset
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-white/15 bg-white/[0.04] p-2.5 text-[10px] leading-relaxed text-white/50">
          {error}
        </p>
      )}

      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-white/40">
        Tracking runs fully in your browser via MediaPipe. The smoothed camera
        path is burned into the export crop.
      </p>
    </div>
  );
}

function EditTab() {
  const clips = useStudio((s) => s.clips);
  const activeClipId = useStudio((s) => s.activeClipId);
  const setActiveClip = useStudio((s) => s.setActiveClip);
  const removeClip = useStudio((s) => s.removeClip);
  const updateClip = useStudio((s) => s.updateClip);
  const addAll = useStudio((s) => s.addAllHighlights);
  const clearTimeline = useStudio((s) => s.clearTimeline);
  const pending = useStudio((s) => s.pendingHighlights);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const showToast = useStudio((s) => s.showToast);
  const commitHistory = useStudio((s) => s.commitHistory);

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between px-1">
        <p className="s-label">
          Timeline · {clips.length} clip{clips.length === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              addAll();
              showToast("All highlights added to timeline");
            }}
            disabled={pending.length === 0}
            className="s-btn px-2.5 py-1 text-[10px]"
          >
            Add all
          </button>
          <button
            onClick={() => {
              if (clips.length === 0) return;
              clearTimeline();
              showToast("Timeline cleared");
            }}
            disabled={clips.length === 0}
            className="s-btn px-2.5 py-1 text-[10px]"
          >
            Clear
          </button>
        </div>
      </div>

      {clips.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center text-[11px] leading-relaxed text-white/40">
          Nothing on the timeline yet. Add highlights from the AI tab, or press{" "}
          <kbd className="rounded border border-white/20 px-1 font-mono text-[9px] text-white/70">A</kbd> to clip at the
          playhead.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {clips.map((c, i) => (
          <div
            key={c.id}
            className={`rounded-2xl border p-2.5 transition-colors ${
              activeClipId === c.id ? "border-white/50 bg-white/[0.08]" : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveClip(activeClipId === c.id ? null : c.id)}
                className="min-w-0 flex-1 text-left"
                title="Select this clip"
              >
                <span className="block truncate text-[11px] font-semibold text-white/85">
                  {c.label || `Clip ${i + 1}`}
                </span>
                <span className="font-mono text-[9px] text-white/45">
                  {fmtClock(c.start)} → {fmtClock(c.end)} · {(c.end - c.start).toFixed(1)}s
                </span>
              </button>
              <button
                onClick={() => {
                  setPlayhead(c.start);
                  showToast(`Seeking to ${fmtClock(c.start)}`);
                }}
                className="s-btn px-2 py-1 text-[10px]"
              >
                Seek
              </button>
              <button
                onClick={() => removeClip(c.id)}
                className="rounded px-1.5 text-xs text-white/30 transition-colors hover:text-white"
                aria-label="Remove clip"
              >
                ×
              </button>
            </div>
            <input
              value={c.label}
              onChange={(e) => updateClip(c.id, { label: e.target.value })}
              onBlur={() => commitHistory()}
              aria-label="Clip label"
              className="s-input mt-1.5 px-2 py-1 text-[10px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportTab({ onExport }: { onExport: () => void }) {
  const clips = useStudio((s) => s.clips);
  const aspect = useStudio((s) => s.aspect);
  const reframe = useStudio((s) => s.reframe);
  const captions = useStudio((s) => s.captions);
  const exportState = useStudio((s) => s.exportState);
  const exportResultUrl = useStudio((s) => s.exportResultUrl);
  const showToast = useStudio((s) => s.showToast);

  const busy = exportState === "running" || exportState === "loading";

  const downloadLast = () => {
    if (!exportResultUrl) return;
    const a = document.createElement("a");
    a.href = exportResultUrl;
    a.download = `ittyclip-${aspect}-export.mp4`;
    a.click();
    showToast("Downloading export");
  };

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="s-label mb-2">Export summary</p>
        <div className="flex flex-col gap-1.5 font-mono text-[10px] text-white/55">
          <p>
            <span className="text-white/35">clips:</span> {clips.length > 0 ? `${clips.length} in timeline` : "full video"}
          </p>
          <p>
            <span className="text-white/35">aspect:</span> {aspect}
          </p>
          <p>
            <span className="text-white/35">captions:</span> {captions.length > 0 ? `${captions.length} lines` : "off"}
          </p>
          <p>
            <span className="text-white/35">reframe:</span>{" "}
            {reframe.enabled ? (reframe.mode === "tracked" ? "tracked" : "center") : "off"}
          </p>
        </div>
        <button
          onClick={onExport}
          disabled={busy}
          className="mt-3 w-full rounded-full bg-white px-3 py-2.5 text-[11px] font-bold text-black transition-colors hover:bg-white/85 disabled:opacity-40"
        >
          {busy ? "Exporting…" : "Open export dialog"}
        </button>
      </div>

      {exportState === "done" && exportResultUrl && (
        <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-3">
          <p className="s-label mb-2">Last export</p>
          <button
            onClick={downloadLast}
            className="block w-full rounded-full bg-white px-3 py-2 text-center text-[11px] font-semibold text-black transition-colors hover:bg-white/85"
          >
            Download result
          </button>
        </div>
      )}

      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-white/40">
        Encoding runs entirely in your browser with ffmpeg.wasm — nothing is uploaded.
      </p>
    </div>
  );
}

export function MediaPanel({ onExport }: { onExport: () => void }) {
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-black/40 lg:w-80">
      <div className="s-seg mx-3 mt-3">
        {(
          [
            ["ai", "AI"],
            ["edit", "Edit"],
            ["captions", "Captions"],
            ["reframe", "Reframe"],
            ["export", "Export"],
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
        {tab === "ai" && <AITab onExport={onExport} />}
        {tab === "edit" && <EditTab />}
        {tab === "captions" && <CaptionsTab />}
        {tab === "reframe" && <ReframeTab />}
        {tab === "export" && <ExportTab onExport={onExport} />}
      </div>
    </aside>
  );
}
