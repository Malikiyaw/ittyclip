"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const COLS = [
  {
    title: "Product",
    links: ["Studio", "AI Engine", "Caption Styles", "Platform Presets", "Changelog"],
  },
  {
    title: "Resources",
    links: ["Docs", "API Reference", "Creator Academy", "Clip Ideas Database", "Status"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Press Kit", "Privacy", "Terms"],
  },
];

export function FooterParallax() {
  const bgRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Parallax background layers
      if (bgRef.current) {
        gsap.fromTo(
          bgRef.current.querySelectorAll(".parallax-layer"),
          { y: 120 },
          {
            y: -120,
            ease: "none",
            scrollTrigger: {
              trigger: bgRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }

      // Giant wordmark parallax drift
      if (wordRef.current) {
        gsap.fromTo(
          wordRef.current,
          { yPercent: 25, opacity: 0.2 },
          {
            yPercent: -25,
            opacity: 0.6,
            ease: "none",
            scrollTrigger: {
              trigger: wordRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink">
      {/* Parallax background layers */}
      <div ref={bgRef} className="absolute inset-0" aria-hidden>
        <div className="parallax-layer absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-brand/20 blur-[120px]" />
        <div className="parallax-layer absolute top-1/3 right-1/5 h-80 w-80 rounded-full bg-hot/10 blur-[100px]" />
        <div className="parallax-layer absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-brand2/15 blur-[110px]" />
        <div className="grid-bg absolute inset-0 opacity-40" />
      </div>

      {/* Giant outlined wordmark */}
      <div
        ref={wordRef}
        className="text-outline pointer-events-none absolute inset-x-0 bottom-[-2rem] select-none whitespace-nowrap text-center font-display text-[clamp(4rem,18vw,16rem)] font-bold leading-none text-transparent"
        aria-hidden
      >
        ittyclip
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-32 pt-20">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5" data-cursor="hover">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand via-brand2 to-hot">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M5 3.5 L13 8 L5 12.5 Z" fill="white" />
                </svg>
              </span>
              <span className="font-display text-lg font-bold">
                itty<span className="text-gradient">clip</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-mute">
              The browser-native AI clipping studio. Every long video, clipped into gold — entirely on your
              hardware.
            </p>
            <div className="mt-5 flex gap-2">
              {["X", "TikTok", "Discord", "YouTube"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="glass rounded-full px-3.5 py-1.5 text-xs text-mute transition-colors hover:text-fg"
                  aria-label={`ittyclip on ${s}`}
                  data-cursor="hover"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="font-mono text-xs tracking-widest text-mute uppercase">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-mute transition-colors hover:text-fg" data-cursor="hover">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 sm:flex-row">
          <p className="text-xs text-mute">© {new Date().getFullYear()} ittyclip. All clips reserved.</p>
          <p className="font-mono text-[11px] text-mute/60">built with wasm · zero cloud · zero uploads</p>
        </div>
      </div>
    </footer>
  );
}
