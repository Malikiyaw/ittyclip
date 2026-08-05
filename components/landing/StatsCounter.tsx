"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function StatsCounter({
  value,
  suffix = "",
  label,
  decimals = 0,
  prefix = "",
}: {
  value: number;
  suffix?: string;
  label: string;
  decimals?: number;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString();
      return;
    }

    const ctx = gsap.context(() => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: value,
        duration: 1.8,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
        onUpdate: () => {
          el.textContent = decimals
            ? obj.v.toFixed(decimals)
            : Math.round(obj.v).toLocaleString();
        },
      });
    }, el);
    return () => ctx.revert();
  }, [value, decimals]);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line px-6 py-8 text-center transition-colors duration-500 hover:border-brand/40">
      <div
        className="absolute inset-0 bg-[radial-gradient(400px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),rgba(124,92,255,0.1),transparent_40%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--spot-x", `${((e.clientX - r.left) / r.width) * 100}%`);
          e.currentTarget.style.setProperty("--spot-y", `${((e.clientY - r.top) / r.height) * 100}%`);
        }}
      />
      <div className="relative">
        <p className="font-display text-4xl font-bold md:text-5xl">
          {prefix}
          <span ref={ref}>0</span>
          {suffix && <span className="text-gradient">{suffix}</span>}
        </p>
        <p className="mt-2 text-xs text-mute md:text-sm">{label}</p>
      </div>
    </div>
  );
}
