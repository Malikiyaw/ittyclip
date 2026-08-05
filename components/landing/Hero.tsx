"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { HeroCopy } from "@/components/landing/HeroCopy";

const Hero3D = dynamic(() => import("@/components/landing/Hero3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgba(124,92,255,0.16),transparent_70%)]" />
  ),
});

const FLOATING_CHIPS = [
  {
    className: "left-[6%] top-[22%]",
    title: "AI found 6 highlights",
    sub: "42s · score 98 · speech spike",
    delay: 0,
  },
  {
    className: "right-[4%] top-[28%]",
    title: "this is INSANE",
    sub: "caption · pop style · v2.0",
    delay: 0.8,
  },
  {
    className: "left-[8%] bottom-[22%]",
    title: "9:17 · 1080×1920",
    sub: "TikTok preset armed",
    delay: 1.4,
  },
  {
    className: "right-[12%] bottom-[36%]",
    title: "4K · local encode",
    sub: "ffmpeg.wasm · zero cloud",
    delay: 0.4,
  },
];

function GeometricFloat({ mouse }: { mouse: { x: number; y: number } }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const elements = [
    { size: 320, rotation: "rotate-3", opacity: 0.08, dash: "4,6" },
    { size: 200, rotation: "rotate-12", opacity: 0.06, dash: "2,4" },
    { size: 140, rotation: "-rotate-6", opacity: 0.05, dash: "3,8" },
  ];

  return (
    <>
      {elements.map((el, i) => (
        <div
          key={i}
          className={`absolute ${el.rotation} border border-dashed border-brand2/30 rounded-full`}
          style={{
            width: el.size,
            height: el.size,
            opacity: el.opacity,
            top: 50 + (mounted ? mouse.y * 4 - el.opacity * 10 : 0) + (i % 2 === 0 ? -10 : 10) + "%",
            left: 50 + (mounted ? mouse.x * 5 - el.opacity * 5 : 0) + (i % 2 === 0 ? -15 : 20) + "%",
            transform: `translate(-50%, -50%)`,
            animationDelay: `${i * 0.3}s`,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}

export function Hero() {
  const [mobile, setMobile] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);

    if (!mobile) {
      const onMove = (e: MouseEvent) => {
        const rect = heroRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMouse({
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5,
        });
      };
      const current = heroRef.current;
      current?.addEventListener("mousemove", onMove);
      return () => {
        current?.removeEventListener("mousemove", onMove);
        mq.removeEventListener("change", update);
      };
    }
    return () => mq.removeEventListener("change", update);
  }, [mobile]);

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
    >
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_32%,rgba(124,92,255,0.18),transparent_70%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_78%_65%,rgba(34,211,238,0.1),transparent_70%)]"
        aria-hidden
      />

      {!mobile && <GeometricFloat mouse={mouse} />}

      <div className="absolute inset-0" aria-hidden>
        <Hero3D mobile={mobile} />
      </div>

      {FLOATING_CHIPS.map((chip) => (
        <div
          key={chip.title}
          className={`absolute ${chip.className} hidden xl:flex animate-float`}
          style={{ animationDelay: `${chip.delay}s` }}
        >
          <div className="glass rounded-xl px-4 py-3 ring-glow">
            <p className="font-display text-sm font-semibold text-white">{chip.title}</p>
            <p className="mt-0.5 font-mono text-[11px] text-mute">{chip.sub}</p>
          </div>
        </div>
      ))}

      <div className="noise absolute inset-0 pointer-events-none" aria-hidden />

      <HeroCopy />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 cursor-default font-mono text-[11px] tracking-[0.25em] text-mute/50">
        SCROLL — THE CLIPS TILT WITH YOU
      </div>
    </section>
  );
}
