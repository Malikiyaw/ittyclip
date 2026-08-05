"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const dot = dotRef.current!;
    const ring = ringRef.current!;
    const xDot = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2.out" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2.out" });
    const xRing = gsap.quickTo(ring, "x", { duration: 0.38, ease: "power3.out" });
    const yRing = gsap.quickTo(ring, "y", { duration: 0.38, ease: "power3.out" });

    const move = (e: MouseEvent) => {
      xDot(e.clientX);
      yDot(e.clientY);
      xRing(e.clientX);
      yRing(e.clientY);
    };

    const over = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("a, button, [data-cursor]");
      gsap.to(ring, {
        scale: t ? 2.1 : 1,
        borderColor: t ? "rgba(124,92,255,0.9)" : "rgba(255,255,255,0.4)",
        duration: 0.3,
      });
      gsap.to(dot, { scale: t ? 0.4 : 1, duration: 0.3 });
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[999] hidden md:block" aria-hidden>
      <div
        ref={dotRef}
        className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{ top: 0, left: 0 }}
      />
      <div
        ref={ringRef}
        className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
        style={{ top: 0, left: 0 }}
      />
    </div>
  );
}
