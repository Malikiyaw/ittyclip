"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Reveal } from "@/components/landing/Reveal";
import { StatsCounter } from "@/components/landing/StatsCounter";

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: 42, suffix: "M+", label: "clips cut in the browser" },
  { value: 2.1, suffix: "B", label: "views generated", decimals: 1 },
  { value: 12400, suffix: "+", label: "creators shipped" },
  { value: 97, suffix: "", label: "languages captioned" },
];

export function StatsStrip() {
  const lineRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = lineRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.4,
          ease: "power3.inOut",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        }
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section id="pipeline" className="relative overflow-hidden border-y border-line py-28">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(34,211,238,0.08),transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal className="mb-14 text-center">
          <span className="chip uppercase tracking-[0.22em]">THE ENGINE</span>
          <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl">
            A local AI pipeline that treats your video like{" "}
            <span className="text-gradient">a private vault</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-mute sm:text-lg">
            Whisper-class audio mapping, retention scoring and ffmpeg encoding — all compiled to
            WebAssembly and running on your hardware. Your footage never touches a server.
          </p>
        </Reveal>

        {/* Dividing-line reveal */}
        <div ref={lineRef} className="mx-auto mb-12 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-transparent via-brand/60 to-transparent" aria-hidden />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <StatsCounter value={s.value} suffix={s.suffix} label={s.label} decimals={s.decimals} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
