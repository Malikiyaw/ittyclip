"use client";

import { useEffect, useRef } from "react";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { Reveal } from "@/components/landing/Reveal";

export function CTAVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const t = 0;

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "rgba(124,92,255,0.25)");
      grad.addColorStop(0.5, "rgba(34,211,238,0.12)");
      grad.addColorStop(1, "rgba(244,75,148,0.2)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Flowing particles
      const n = Math.min(40, Math.floor(w / 40));
      for (let i = 0; i < n; i++) {
        const x = (i * 137.5 + time * 0.02) % w;
        const y = h * 0.3 + Math.sin(time * 0.001 + i) * h * 0.25;
        const r = 1 + Math.sin(time * 0.002 + i) * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(247,201,72,${0.15 + Math.sin(time * 0.003 + i) * 0.1})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section className="relative mx-auto max-w-7xl px-6 py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-[40px] border border-line bg-panel/60 px-6 py-20 text-center md:py-28">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
          <div className="grid-bg absolute inset-0 opacity-40" aria-hidden />
          <div className="relative">
            <h2 className="font-display mx-auto max-w-3xl text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl md:text-6xl">
              Your next viral clip is <span className="text-gradient">already inside</span> your footage
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-mute sm:text-lg">
              Drop a video. Watch the engine find gold. Ship it before your rivals wake up.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <MagneticButton href="/studio" className="btn-primary rounded-full px-10 py-4 font-display text-base font-semibold text-white">
                Open the Studio — it&apos;s free
              </MagneticButton>
              <MagneticButton href="#features" className="glass rounded-full px-10 py-4 font-display text-base text-fg">
                Browse features
              </MagneticButton>
            </div>
            <p className="mt-8 font-mono text-[11px] tracking-widest text-mute/70">
              NO SIGN-UP · NO UPLOAD · 100% IN YOUR BROWSER
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
