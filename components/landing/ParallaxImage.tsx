"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function ParallaxImage({
  src,
  alt,
  className = "",
  speed = 0.12,
}: {
  src: string;
  alt: string;
  className?: string;
  speed?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        img,
        { yPercent: -speed * 100 },
        {
          yPercent: speed * 100,
          ease: "none",
          scrollTrigger: {
            trigger: wrap,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }, wrap);

    return () => ctx.revert();
  }, [speed]);

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className}`}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        className="h-[120%] w-full scale-110 object-cover will-change-transform"
        style={{ transform: "translateY(-10%)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" aria-hidden />
    </div>
  );
}
