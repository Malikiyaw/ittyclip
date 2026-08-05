"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { Reveal } from "@/components/landing/Reveal";

const PREVIEW_CAPTIONS = [
  "this is the moment",
  "everyone missed",
  "3 hours → 30 seconds",
  "captioned. cropped. shipped.",
];

function MiniWave() {
  return (
    <div className="flex h-10 items-end gap-[3px]">
      {Array.from({ length: 48 }).map((_, i) => {
        const h = 20 + Math.abs(Math.sin(i * 0.9 + i)) * 18 + ((i * 7) % 9);
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-gradient-to-t from-brand/70 to-brand2"
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}

function EditorMock() {
  const [capIdx, setCapIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setCapIdx((i) => (i + 1) % PREVIEW_CAPTIONS.length), 1600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, { rotateY: x * 9, rotateX: -y * 7, transformPerspective: 1100, duration: 0.6, ease: "power2.out" });
    };
    const onLeave = () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.9, ease: "power3.out" });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="relative mx-auto mt-16 w-full max-w-5xl" style={{ transformStyle: "preserve-3d" }}>
      <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-r from-brand/25 via-brand2/20 to-hot/25 blur-3xl" aria-hidden />
      <div className="glass-deep relative overflow-hidden rounded-2xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] ring-glow">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="ml-3 flex items-center gap-2 font-mono text-xs text-mute">
            <span className="text-brand2">●</span> studio / epic-gaming-podcast.mp4 — 1:24:00
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <span className="chip">9:16</span>
            <span className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white">Export →</span>
          </div>
        </div>

        <div className="grid grid-cols-[180px_1fr_220px]">
          <div className="hidden border-r border-line p-4 sm:block">
            <p className="mb-3 font-mono text-[10px] tracking-widest text-mute uppercase">AI HIGHLIGHTS</p>
            {[
              { t: "Punch-in · 01:12", s: 98, hot: true },
              { t: "The reveal · 22:40", s: 94 },
              { t: "Q&A spike · 41:07", s: 91 },
              { t: "Story arc · 55:30", s: 87 },
            ].map((c) => (
              <div key={c.t} className={`mb-2 rounded-lg border px-3 py-2 ${c.hot ? "border-brand/50 bg-brand/10" : "border-line bg-panel"}`}>
                <p className="text-[11px] font-medium text-fg">{c.t}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand2" style={{ width: `${c.s}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-brand2">{c.s}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center bg-[#07080f] p-6">
            <div className="relative aspect-[9/16] w-56 overflow-hidden rounded-xl bg-gradient-to-b from-panel3 to-black shadow-2xl ring-1 ring-white/10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(124,92,255,0.4),transparent_65%)]" />
              <div className="absolute top-4 left-4 font-mono text-[9px] text-white/60">@creator · 1:24:00</div>
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M5 3.5 L13 8 L5 12.5 Z" fill="white" />
                  </svg>
                </div>
              </div>
              <div className="absolute inset-x-3 bottom-[26%] rounded-xl bg-black/60 px-3 py-2.5 text-center">
                <p className="text-xs font-bold text-white">{PREVIEW_CAPTIONS[capIdx]}</p>
              </div>
              <div className="absolute right-4 bottom-4 left-4 flex items-center gap-1">
                <MiniWave />
              </div>
              <div className="absolute bottom-0 h-[3px] w-1/2 rounded-full bg-gradient-to-r from-brand to-hot" />
            </div>
          </div>

          <div className="hidden border-l border-line p-4 sm:block">
            <p className="mb-3 font-mono text-[10px] tracking-widest text-mute uppercase">CAPTIONS</p>
            {PREVIEW_CAPTIONS.map((c, i) => (
              <div key={c} className={`mb-2 rounded-lg px-3 py-2 text-[11px] ${i === capIdx ? "bg-brand/15 text-white" : "text-mute"}`}>
                {c}
              </div>
            ))}
            <div className="mt-4 rounded-lg border border-line bg-panel px-3 py-2">
              <p className="font-mono text-[9px] tracking-widest text-mute uppercase">Style</p>
              <div className="mt-1.5 flex gap-1.5">
                {["#22D3EE", "#F472B6", "#7C5CFF", "#ffffff"].map((c) => (
                  <span key={c} className="h-4 w-4 rounded-full" style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-line px-5 py-3">
          <span className="font-mono text-[10px] text-brand2">▶ 01:12</span>
          <div className="relative h-12 flex-1 overflow-hidden rounded-lg bg-panel">
            <div className="absolute inset-x-0 top-1.5 bottom-1.5 flex items-end gap-[2px] px-2">
              {Array.from({ length: 90 }).map((_, i) => {
                const h = 6 + ((i * 13) % 28);
                const inClip = i > 30 && i < 52;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${inClip ? "bg-gradient-to-t from-brand to-brand2" : "bg-line"}`}
                    style={{ height: h }}
                  />
                );
              })}
            </div>
            <div className="absolute top-0 bottom-0 left-[34%] w-[22%] rounded-md border border-brand2/60 bg-brand2/10" />
            <div className="absolute top-0 bottom-0 w-[2px] bg-hot shadow-[0_0_8px_#F472B6]" style={{ left: "47%" }} />
          </div>
          <span className="font-mono text-[10px] text-mute">01:24:00</span>
        </div>
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section id="showcase" className="relative mx-auto max-w-7xl px-6 py-28">
      <SectionHeading
        eyebrow="THE STUDIO"
        title="One hour in. Thirty seconds out."
        sub="This is the actual ittyclip workspace — not a mockup, the real interface you'll be editing in. Drop a file, let the engine hunt, trim, caption, export."
      />
      <Reveal delay={0.1}>
        <EditorMock />
      </Reveal>
    </section>
  );
}
