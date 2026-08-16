"use client";

import { useMemo, useState } from "react";
import { useStudio } from "@/store/studio";

type Op = "hooks" | "titles" | "description" | "hashtags" | "platform";
type Platform = "tiktok" | "youtube" | "instagram";
type Result = { items?: string[]; description?: string; keywords?: string[]; hashtags?: string[]; hook?: string; title?: string; cta?: string };

async function callAI(operation: Op, context: unknown, platform: Platform) {
  const res = await fetch("/api/ai/phase4", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, platform, context }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "AI request failed");
  return data as { value: Result };
}

export function AIContentTools() {
  const media = useStudio((s) => s.media);
  const captions = useStudio((s) => s.captions);
  const activeClipId = useStudio((s) => s.activeClipId);
  const clips = useStudio((s) => s.clips);
  const showToast = useStudio((s) => s.showToast);
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [busy, setBusy] = useState<Op | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeClip = useMemo(() => clips.find((c) => c.id === activeClipId) ?? null, [clips, activeClipId]);
  const context = useMemo(() => ({ duration: media?.duration ?? 0, transcript: captions.map((c) => ({ start: c.start, end: c.end, text: c.text })), selectedClip: activeClip ? { start: activeClip.start, end: activeClip.end } : undefined }), [media?.duration, captions, activeClip]);

  const run = async (operation: Op) => {
    if (!media || captions.length === 0) { showToast("Transcribe the video first — AI needs the transcript"); return; }
    setBusy(operation); setError(null);
    try { const data = await callAI(operation, context, platform); setResult(data.value); showToast(`AI ${operation} ready`); }
    catch (e) { setError(e instanceof Error ? e.message : "AI request failed"); }
    finally { setBusy(null); }
  };

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); showToast(`${label} copied`); }
    catch { showToast("Clipboard unavailable — select and copy the text"); }
  };
  const allText = result ? [result.hook, result.title, result.description, result.cta, ...(result.hashtags ?? []).map((x) => `#${x}`)].filter(Boolean).join("\n\n") : "";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between">
        <div><p className="s-label">AI Content Studio</p><p className="mt-1 text-[10px] text-white/40">Phase 4 · grounded in your transcript</p></div>
        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[8px] text-white/45">AI</span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {(["tiktok", "youtube", "instagram"] as Platform[]).map((p) => <button key={p} onClick={() => setPlatform(p)} className={`flex-1 rounded-lg border px-2 py-1.5 text-[9px] capitalize ${platform === p ? "border-white/40 bg-white text-black" : "border-white/10 text-white/50"}`}>{p}</button>)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["hooks", "titles", "description", "hashtags"] as Op[]).map((op) => <button key={op} onClick={() => void run(op)} disabled={busy !== null || captions.length === 0} className="rounded-xl border border-white/15 bg-white/[0.04] px-2 py-2.5 text-[10px] font-semibold capitalize text-white disabled:opacity-40">{busy === op ? "Generating…" : op}</button>)}
      </div>
      <button onClick={() => void run("platform")} disabled={busy !== null || captions.length === 0} className="mt-2 w-full rounded-xl bg-white px-3 py-2.5 text-[10px] font-bold capitalize text-black disabled:opacity-40">{busy === "platform" ? "Building content pack…" : `✨ Generate ${platform} pack`}</button>
      {result && <div className="mt-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5">
        {result.items && <div className="flex flex-col gap-1.5">{result.items.map((item, i) => <button key={`${i}-${item}`} onClick={() => void copy(item, "Option")} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left text-[10px] text-white/80">{i + 1}. {item}</button>)}</div>}
        {result.hook && <Output label="Hook" value={result.hook} onCopy={copy} />}
        {result.title && <Output label="Title" value={result.title} onCopy={copy} />}
        {result.description && <Output label="Description" value={result.description} onCopy={copy} />}
        {result.cta && <Output label="CTA" value={result.cta} onCopy={copy} />}
        {result.hashtags && <div className="mt-2 flex flex-wrap gap-1.5">{result.hashtags.map((tag) => <button key={tag} onClick={() => void copy(`#${tag}`, "Hashtag")} className="rounded-full border border-white/15 px-2 py-1 text-[9px] text-white/65">#{tag}</button>)}</div>}
        {allText && <button onClick={() => void copy(allText, "Content pack")} className="mt-2 w-full rounded-lg bg-white/10 px-2 py-2 text-[9px] font-semibold text-white">Copy entire result</button>}
      </div>}
      {error && <p className="mt-2 rounded-lg border border-red-300/15 bg-red-300/5 p-2 text-[9px] text-red-200/75">{error}</p>}
    </div>
  );
}

function Output({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string, label: string) => Promise<void> }) {
  return <button onClick={() => void onCopy(value, label)} className="mt-2 block w-full rounded-lg border border-white/10 bg-white/[0.03] p-2 text-left"><span className="font-mono text-[8px] uppercase tracking-wider text-white/35">{label}</span><span className="mt-1 block text-[10px] leading-relaxed text-white/75">{value}</span></button>;
}
