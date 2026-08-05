"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Reveal } from "@/components/landing/Reveal";

gsap.registerPlugin(ScrollTrigger);

export function EditorialSplit({
  eyebrow,
  title,
  body,
  visual,
  reverse = false,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  body: string;
  visual: ReactNode;
  reverse?: boolean;
  id?: string;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const text = textRef.current;
    const vis = visualRef.current;
    if (!text || !vis) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        vis,
        { scale: 0.92, opacity: 0.6 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: vis,
            start: "top 90%",
            end: "top 40%",
            scrub: true,
          },
        }
      );
    }, vis);

    return () => ctx.revert();
  }, []);

  return (
    <section id={id} className="mx-auto max-w-7xl px-6 py-28">
      <div
        className={`grid items-center gap-12 md:grid-cols-2 md:gap-16 ${reverse ? "md:[direction:rtl]" : ""}`}
      >
        <div ref={textRef} className="[direction:ltr]">
          <Reveal>
            <span className="chip uppercase tracking-[0.22em]">{eyebrow}</span>
            <h2 className="font-display mt-5 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl">
              {title}
            </h2>
            <p className="mt-6 max-w-md text-mute sm:text-lg">{body}</p>
          </Reveal>
        </div>
        <div ref={visualRef} className="[direction:ltr]">
          <Reveal delay={0.1}>{visual}</Reveal>
        </div>
      </div>
    </section>
  );
}
