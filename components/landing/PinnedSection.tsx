"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function PinnedSection({
  children,
  id,
  start = "top top",
  end = "+=150%",
  className = "",
}: {
  children: ReactNode;
  id?: string;
  start?: string;
  end?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start,
        end,
        pin: true,
        scrub: true,
        anticipatePin: 1,
      });
    }, el);

    return () => ctx.revert();
  }, [start, end]);

  return (
    <section ref={ref} id={id} className={`relative overflow-hidden ${className}`}>
      {children}
    </section>
  );
}
