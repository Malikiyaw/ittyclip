"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type StatProps = {
  icon: string;
  value: number;
  suffix: string;
  decimals: number;
  label: string;
  duration: number;
  delay: number;
  entranceDelay: string;
};

function Stat({ icon, value, suffix, decimals, label, duration, delay, entranceDelay }: StatProps) {
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = numRef.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const render = (v: number) => {
      el.textContent = v.toFixed(decimals);
    };

    if (reduced) {
      render(value);
      return;
    }

    let raf = 0;
    let t0 = 0;

    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      render(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          io.disconnect();
          setTimeout(() => {
            raf = requestAnimationFrame(tick);
          }, delay);
        }
      },
      { threshold: 0.25 }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, decimals, duration, delay]);

  return (
    <div className="stat anim" style={{ "--d": entranceDelay } as React.CSSProperties}>
      <span className="stat-icon" aria-hidden>
        {icon}
      </span>
      <span className="stat-value">
        <span ref={numRef}>0</span>
        {suffix}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

const STATS = [
  { icon: "★", value: 6, suffix: "", decimals: 0, label: "AI Highlight Moments" },
  { icon: "↓", value: 0, suffix: "s", decimals: 0, label: "Upload Time — Zero Uploads" },
  { icon: "#", value: 4, suffix: "", decimals: 0, label: "Aspect Ratios · Reels Ready" },
  { icon: "%", value: 100, suffix: "%", decimals: 0, label: "In-Browser Processing" },
];

const NAV_LINKS = [
  { label: "Home", href: "/", active: true },
  { label: "Studio", href: "/studio", active: false },
  { label: "Contact", href: "#", active: false },
];

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

export default function SwissLanding() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.classList.add("menu-open");
    } else {
      document.body.classList.remove("menu-open");
    }
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 720) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div className="swiss">
      <div className="bg" aria-hidden>
        <video className="bg-video" autoPlay muted loop playsInline>
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      </div>

      <div className="page">
        <header className="header">
          <Link className="logo" href="/" aria-label="ittyclip home">
            <img src="/assets/logo.jpg" alt="" width={52} height={52} />
          </Link>

          <nav className="nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className={link.active ? "active" : ""}>
                {link.label}
              </Link>
            ))}
          </nav>

          <Link className="sign-in" href="/studio">
            Open Studio
          </Link>

          <button
            type="button"
            className={`burger${open ? " open" : ""}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        <section className="hero">
          <div className="trust anim" style={{ "--d": "0.05s" } as React.CSSProperties}>
            <span className="avatar avatar-1">
              <span className="avatar-inner">
                <i className="fa-brands fa-tiktok" aria-hidden />
              </span>
            </span>
            <span className="avatar avatar-2">
              <span className="avatar-inner">
                <i className="fa-brands fa-youtube" aria-hidden />
              </span>
            </span>
            <span className="avatar avatar-3">
              <span className="avatar-inner">
                <i className="fa-brands fa-instagram" aria-hidden />
              </span>
            </span>
            <span className="trust-pill">Built for TikTok · Reels · Shorts</span>
          </div>

          <h1 className="headline">
            <span className="hl-line" style={{ "--d": "0.12s" } as React.CSSProperties}>
              Every long video,
            </span>
            <span className="hl-line" style={{ "--d": "0.3s" } as React.CSSProperties}>
              clipped into gold.
            </span>
          </h1>

          <p className="subhead anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
            ittyclip hunts your best moments, auto-times captions with on-device
            whisper, and exports vertical shorts — entirely in your browser.
            Nothing uploads, nothing waits.
          </p>

          <Link className="cta anim" style={{ "--d": "0.4s" } as React.CSSProperties} href="/studio">
            Launch the studio
          </Link>
        </section>

        <footer className="stats">
          {STATS.map((s, i) => (
            <Stat
              key={s.label}
              icon={s.icon}
              value={s.value}
              suffix={s.suffix}
              decimals={s.decimals}
              label={s.label}
              duration={1500 + i * 80}
              delay={480 + i * 90}
              entranceDelay={`${0.5 + i * 0.08}s`}
            />
          ))}
        </footer>
      </div>

      <div
        id="mobile-menu"
        className="menu-overlay"
        hidden={!open}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <nav className="menu-sheet" aria-label="Mobile">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              className={`menu-link${link.active ? " active" : ""}`}
              style={{ "--d": `${0.03 + i * 0.05}s` } as React.CSSProperties}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link className="menu-signin" href="/studio" onClick={() => setOpen(false)}>
            Open Studio
          </Link>
        </nav>
      </div>
    </div>
  );
}
