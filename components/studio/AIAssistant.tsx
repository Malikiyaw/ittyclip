"use client";

import { useMemo, useState } from "react";
import { useStudio } from "@/store/studio";
import type { AspectKey, CaptionStyleKey, Moment } from "@/lib/types";
import type { Phase6Action } from "@/lib/ai/phase6";
import { aiHeaders } from "@/lib/ai/settings";

type Plan = { summary: string; actions: Phase6Action[]; model?: string; cached?: boolean };

const EXAMPLES = [
  "Make this ready for TikTok",
  "Use bold captions and zoom in a little",
  "Tighten the active clip and make the captions punchier",
];

export function AIAssistant() {
  const media = useStudio((s) => s.media);
  const captions = useStudio((s) => s.captions);
  const clips = useStudio((s) => s.clips);
  const activeClipId = useStudio((s) => s.activeClipId);
  const captionStyle = useStudio((s) => s.captionStyle);
  const aspect = useStudio((s) => s.aspect);
  const zoom = useStudio((s) => s.zoom);
  const playhead = useStudio((s) => s.playhead);
  const setAspect = useStudio((s) => s.setAspect);
  const setCaptionStyle = useStudio((s) => s.setCaptionStyle);
  const setZoom = useStudio((s) => s.setZoom);
  const updateClip = useStudio((s) => s.updateClip);
  const addClip = useStudio((s) => s.addClip);
  const showToast = useStudio((s) => s.showToast);

  const activeClip = useMemo(() => clips.find((c) => c.id === activeClipId) ?? null, [clips, activeClipId]);
  const [request, setRequest] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  if (!media) return null;
  const duration = media.duration;

  async function ask(prompt = request) {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true); setError(null); setPlan(null); setApplied({});
    try {
      const res = await fetch("/api/ai/phase6", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          request: text,
          context: {
            duration,
            playhead,
            activeClip: activeClip ? { start: activeClip.start, end: activeClip.end, label: activeClip.label } : null,
            clips: clips.map((c) => ({ start: c.start, end: c.end, label: c.label })),
            transcript: captions.map((c) => ({ start: c.start, end: c.end, text: c.text })),
            captionStyle,
            aspect,
            zoom,
          },
        }),
      });
      const data = await res.json() as Plan & { error?: string };
      if (!res.ok) throw new Error(data.error || "AI assistant request failed.");
      setPlan(data);
      if (!data.actions?.length) showToast("Itty couldn't find a safe edit for that request.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI assistant failed.");
    } finally { setLoading(false); }
  }

  function applyAction(action: Phase6Action) {
    try {
      const p = action.params;
      if (action.type === "set_aspect") setAspect(p.aspect as AspectKey);
      else if (action.type === "set_caption_style") setCaptionStyle(p.style as CaptionStyleKey);
      else if (action.type === "set_zoom") setZoom(Number(p.zoom));
      else if (action.type === "trim_active_clip") {
        if (!activeClipId || !activeClip) throw new Error("Select a clip before applying the trim.");
        updateClip(activeClipId, { start: Number(p.start), end: Number(p.end) });
      } else if (action.type === "add_clip") {
        const start = Number(p.start), end = Number(p.end);
        const moment: Moment = { id: `ai-${Date.now()}`, start, end, score: 0, label: typeof p.label === "string" ? p.label : "AI clip" };
        addClip(moment);
      }
      setApplied((s) => ({ ...s, [action.id]: true }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not apply edit.");
    }
  }

  async function applyAll() {
    if (!plan?.actions.length || applying) return;
    setApplying(true);
    try {
      for (const action of plan.actions) {
        if (!applied[action.id]) applyAction(action);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      showToast(`Applied ${plan.actions.length} AI edit${plan.actions.length === 1 ? "" : "s"}.`);
    } finally { setApplying(false); }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/80 p-3 text-white shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Ask Itty</div>
          <div className="text-xs text-white/85">Describe an edit. Review it. Apply it.</div>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[9px] text-cyan-200">AI</span>
      </div>
      <div className="flex gap-2">
        <input value={request} onChange={(e) => setRequest(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void ask(); }} placeholder="e.g. make this ready for TikTok" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.05] px-3 py-2 text-[11px] outline-none placeholder:text-white/30 focus:border-cyan-300/30" aria-label="Ask Itty edit request" />
        <button type="button" disabled={!request.trim() || loading} onClick={() => void ask()} className="rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Thinking…" : "Ask"}</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => <button key={example} type="button" disabled={loading} onClick={() => { setRequest(example); void ask(example); }} className="rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/55 hover:text-white disabled:opacity-40">{example}</button>)}
      </div>
      {error && <div className="mt-2 rounded-xl border border-red-400/20 bg-red-400/5 p-2 text-[10px] text-red-200">{error}</div>}
      {plan && (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-2 text-[10px] leading-relaxed text-white/70">{plan.summary}</div>
          {plan.actions.map((action) => (
            <div key={action.id} className="rounded-xl border border-white/10 bg-white/[.025] p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="text-[10px] font-medium text-white">{action.title}</div><div className="mt-0.5 text-[9px] leading-relaxed text-white/45">{action.reason}</div></div>
                <button type="button" disabled={!!applied[action.id] || applying} onClick={() => applyAction(action)} className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[9px] text-white/75 disabled:opacity-40">{applied[action.id] ? "Applied" : "Apply"}</button>
              </div>
            </div>
          ))}
          {!!plan.actions.length && <button type="button" disabled={applying || plan.actions.every((a) => applied[a.id])} onClick={() => void applyAll()} className="w-full rounded-xl bg-cyan-300 px-3 py-2 text-[10px] font-semibold text-black disabled:opacity-40">{applying ? "Applying…" : "Apply All"}</button>}
          <div className="text-[8px] text-white/30">AI suggestions are validated before they can change the timeline.</div>
        </div>
      )}
    </section>
  );
}
