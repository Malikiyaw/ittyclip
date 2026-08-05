"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MagneticButton } from "@/components/landing/MagneticButton";

gsap.registerPlugin(ScrollTrigger);

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pipeline", label: "Engine" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll progress bar
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = barRef.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        el.style.transform = `scaleX(${self.progress})`;
      },
    });
    return () => st.kill();
  }, []);

  // Mobile menu animation
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    if (menuOpen) {
      gsap.to(el, {
        opacity: 1,
        pointerEvents: "auto",
        duration: 0.4,
        ease: "power3.out",
      });
      gsap.fromTo(
        el.querySelectorAll(".menu-link"),
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out", delay: 0.1 }
      );
    } else {
      gsap.to(el, { opacity: 0, pointerEvents: "none", duration: 0.3, ease: "power3.in" });
    }
  }, [menuOpen]);

  // Prevent body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "glass-deep border-b border-line" : "bg-transparent"
      }`}
    >
      {/* Scroll progress bar */}
      <div
        ref={barRef}
        className="absolute left-0 top-0 h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-brand via-brand2 to-gold"
        aria-hidden
      />

      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="ittyclip home" data-cursor="hover">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand via-brand2 to-hot shadow-[0_0_24px_rgba(124,92,255,0.5)] transition-transform duration-500 group-hover:rotate-6">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M5 3.5 L13 8 L5 12.5 Z" fill="white" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            itty<span className="text-gradient">clip</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-mute transition-colors hover:text-fg"
              data-cursor="hover"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/studio"
            className="hidden text-sm font-medium text-mute transition-colors hover:text-fg sm:block"
            data-cursor="hover"
          >
            Sign in
          </Link>
          <MagneticButton
            href="/studio"
            className="btn-primary rounded-full px-5 py-2.5 font-display text-sm font-semibold text-white"
          >
            Open Studio
          </MagneticButton>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            data-cursor="hover"
          >
            <span
              className={`h-[2px] w-6 bg-fg transition-all duration-300 ${menuOpen ? "translate-y-[4px] rotate-45" : ""}`}
            />
            <span
              className={`h-[2px] w-6 bg-fg transition-all duration-300 ${menuOpen ? "-translate-y-[4px] -rotate-45" : ""}`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        ref={menuRef}
        className="fixed inset-0 top-16 z-40 flex flex-col bg-ink/95 opacity-0 backdrop-blur-xl md:hidden"
        style={{ pointerEvents: "none" }}
      >
        <div className="flex flex-1 flex-col justify-center gap-2 px-8">
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="menu-link font-display text-4xl font-bold text-fg transition-colors hover:text-gradient"
              style={{ transitionDelay: `${i * 40}ms` }}
              data-cursor="hover"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/studio"
            onClick={() => setMenuOpen(false)}
            className="menu-link mt-6 font-display text-2xl font-semibold text-brand2"
            data-cursor="hover"
          >
            Open Studio →
          </Link>
        </div>
        <div className="px-8 pb-10 font-mono text-xs text-mute/60">
          ittyclip — every long video, clipped into gold.
        </div>
      </div>
    </header>
  );
}
