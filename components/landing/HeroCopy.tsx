"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MagneticButton } from "@/components/landing/MagneticButton";

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: "30+", label: "built-in features" },
  { value: "97", label: "caption languages" },
  { value: "0", label: "installs. no uploads" },
  { value: "∞", label: "clips per hour" },
];

export function HeroCopy() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el.querySelectorAll(".reveal-item"), { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)" });
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.fromTo(
        el.querySelectorAll(".hero-line"),
        { yPercent: 110, rotateX: -50, opacity: 0 },
        { yPercent: 0, rotateX: 0, opacity: 1, duration: 1.2, stagger: 0.12 },
        0.2
      )
        .fromTo(
          el.querySelector(".chip"),
          { opacity: 0, y: 16, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.8 },
          0.1
        )
        .fromTo(
          el.querySelectorAll(".hero-sub"),
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.1 },
          0.9
        )
        .fromTo(
          el.querySelectorAll(".hero-cta"),
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.12 },
          1.1
        )
        .fromTo(
          el.querySelectorAll(".hero-stat"),
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 },
          1.3
        );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pt-32 pb-16 text-center">
      <div className="chip animate-pulse-soft reveal-item mb-8 scale-105 cursor-default" style={{ animationDelay: "0.2s" }}>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand2 shadow-[0_0_10px_#22D3EE]" />
        v2.0 Neural Clip Engine — now in your browser
      </div>

      <div className="-mx-2 [perspective:1200px]">
        <h1 className="font-display max-w-3xl text-[clamp(2.4rem,6.5vw,5.5rem)] leading-[1.0] font-extrabold tracking-tight">
          <span className="block overflow-hidden">
            <span className="hero-line block will-change-transform">
              Every long video.
            </span>
          </span>
          <span className="block overflow-hidden">
            <span className="hero-line block will-change-transform">
              Clipped into <span className="text-gradient">gold</span>.
            </span>
          </span>
        </h1>

        <div className="mt-6 hidden md:block" style={{ perspective: "1000px" }}>
          <p className="hero-sub max-w-2xl text-balance text-base text-mute sm:text-lg md:text-xl">
            <span className="text-fg">ittyclip</span> hunts your best moments, captions them word-perfect, reframes
            them vertical and ships viral shorts — <span className="text-gradient font-semibold">entirely in your browser</span>.
            No uploads. No queues. No waiting.
          </p>
          <p className="hero-sub mt-3 max-w-2xl text-sm text-mute/60">
            1000x the speed of Opus. 1000x the control. Zero cloud.
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <MagneticButton
          href="/studio"
          className="hero-cta btn-primary rounded-full px-8 py-4 font-display text-base font-semibold text-white shadow-[0_0_40px_rgba(124,92,255,0.45)]"
        >
          Open the Studio
          <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </MagneticButton>
        <MagneticButton
          href="#pipeline"
          className="hero-cta glass rounded-full px-8 py-4 font-display text-base font-medium text-fg"
        >
          See the engine
        </MagneticButton>
      </div>

      <div className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="hero-stat glass rounded-2xl px-4 py-4">
            <p className="font-display text-2xl font-bold text-gradient">{s.value}</p>
            <p className="mt-1 text-xs text-mute">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
