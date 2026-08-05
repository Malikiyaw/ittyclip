"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { splitText, type SplitResult } from "@/lib/split";
import type { Easing } from "@/lib/anim";

gsap.registerPlugin(ScrollTrigger);

export function Reveal({
  children,
  delay = 0,
  y = 36,
  className = "",
  once = true,
  duration = 1.05,
  ease = "power3.out",
  start = "top 88%",
  clipPath = false,
  rotateX = 0,
  scale = 1,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
  duration?: number;
  ease?: Easing;
  start?: string;
  clipPath?: boolean;
  rotateX?: number;
  scale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" });
      return;
    }
    const ctx = gsap.context(() => {
      const from: gsap.TweenVars = {
        y,
        opacity: 0,
        ...(clipPath ? { clipPath: "inset(0% 0% 100% 0%)" } : {}),
        ...(rotateX ? { rotateX } : {}),
        ...(scale !== 1 ? { scale } : {}),
      };
      const to: gsap.TweenVars = {
        y: 0,
        opacity: 1,
        ...(clipPath ? { clipPath: "inset(0% 0% 0% 0%)" } : {}),
        ...(rotateX ? { rotateX: 0 } : {}),
        ...(scale !== 1 ? { scale: 1 } : {}),
        duration,
        delay,
        ease,
        scrollTrigger: { trigger: el, start, once },
      };
      gsap.fromTo(el, from, to);
    });
    return () => ctx.revert();
  }, [delay, y, once, duration, ease, start, clipPath, rotateX, scale]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

export function WordReveal({
  text,
  className = "",
  gradientWords = 0,
  delay = 0,
  stagger = 0.035,
  rotateX = -45,
}: {
  text: string;
  className?: string;
  gradientWords?: number;
  delay?: number;
  stagger?: number;
  rotateX?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const words = text.split(" ");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(el, { opacity: 1 });
      gsap.fromTo(
        el.querySelectorAll(".split-char"),
        { yPercent: 110, rotateX, opacity: 0 },
        {
          yPercent: 0,
          rotateX: 0,
          opacity: 1,
          duration: 1.1,
          delay,
          stagger,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        }
      );
    }, el);
    return () => ctx.revert();
  }, [delay, stagger, rotateX]);

  return (
    <span ref={ref} className={`inline-block opacity-0 ${className}`} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} className="inline-block overflow-hidden align-bottom" style={{ perspective: 600 }}>
          <span className="inline-block whitespace-pre" aria-hidden>
            {w.split("").map((ch, ci) => (
              <span
                key={ci}
                className={`split-char inline-block ${wi >= words.length - gradientWords ? "text-gradient" : ""}`}
              >
                {ch}
              </span>
            ))}
            {wi < words.length - 1 ? "\u00A0" : ""}
          </span>
        </span>
      ))}
    </span>
  );
}

export function SplitText({
  text,
  className = "",
  as: Tag = "span",
  gradientWords = 0,
  delay = 0,
  stagger = 0.04,
}: {
  text: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p";
  gradientWords?: number;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1 });
      return;
    }
    const result = splitText(el as HTMLElement);
    if (!result) {
      gsap.set(el, { opacity: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(el, { opacity: 1 });
      gsap.fromTo(
        result.chars.map((c) => c.el),
        { yPercent: 110, rotateX: -45, opacity: 0 },
        {
          yPercent: 0,
          rotateX: 0,
          opacity: 1,
          duration: 1.1,
          delay,
          stagger,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        }
      );
    }, el);
    return () => ctx.revert();
  }, [delay, stagger]);

  const words = text.split(" ");

  return (
    <Tag ref={ref as React.Ref<any>} className={`inline-block opacity-0 ${className}`} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} className="inline-block overflow-hidden align-bottom" style={{ perspective: 600 }}>
          <span className="inline-block whitespace-pre" aria-hidden>
            {w.split("").map((ch, ci) => (
              <span
                key={ci}
                className={`split-char inline-block ${wi >= words.length - gradientWords ? "text-gradient" : ""}`}
              >
                {ch}
              </span>
            ))}
            {wi < words.length - 1 ? "\u00A0" : ""}
          </span>
        </span>
      ))}
    </Tag>
  );
}
