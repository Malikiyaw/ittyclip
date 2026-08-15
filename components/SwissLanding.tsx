"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth, hydrateAuth, isSignedIn } from "@/store/auth";

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

interface Tier {
  name: string;
  price: string;
  per: string;
  desc: string;
  features: string[];
  cta: string;
  featured?: boolean;
  badge?: string;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    per: "forever",
    desc: "Everything you need to taste the gold.",
    features: [
      "3 clips per month",
      "720p export",
      "ittyclip watermark",
      "Classic caption style",
      "tiny.en whisper model",
      "SRT export",
    ],
    cta: "Start free",
  },
  {
    name: "Creator",
    price: "$12",
    per: "/month",
    desc: "For serious creators shipping daily shorts.",
    features: [
      "30 clips per month",
      "1080p export",
      "No watermark",
      "All 6 caption styles",
      "base.en whisper model",
      "SRT export + priority encode",
    ],
    cta: "Get Creator",
    featured: true,
    badge: "Most popular",
  },
  {
    name: "Studio",
    price: "$29",
    per: "/month",
    desc: "For teams and pros with zero limits.",
    features: [
      "Unlimited clips",
      "4K export",
      "No watermark",
      "All styles + beta styles",
      "All whisper models",
      "Priority encoding",
    ],
    cta: "Go Studio",
  },
];

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Studio", href: "/studio" },
  { label: "Pricing", href: "#pricing" },
];

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

export default function SwissLanding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const session = useAuth((s) => s.session);
  const signedIn = session !== null;
  const sheetRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    hydrateAuth();
  }, []);

  const goStudio = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (isSignedIn()) router.push("/studio");
    else router.push("/auth");
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      document.body.classList.add("menu-open");
      const first = sheetRef.current?.querySelector<HTMLElement>("a, button");
      first?.focus();
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
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="swiss">
      <div className="bg" aria-hidden>
        <video
          ref={videoRef}
          className="bg-video"
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      </div>

      <div className="page" id="main">
        <header className="header">
          <Link className="logo" href="/" aria-label="ittyclip home">
            <img src="/assets/logo.jpg" alt="" width={52} height={52} />
          </Link>

          <nav className="nav" aria-label="Primary">
            {NAV_LINKS.map((link) =>
              link.href === "/studio" ? (
                <a key={link.label} href={link.href} onClick={goStudio}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {signedIn ? (
            <Link className="sign-in" href="/studio" onClick={goStudio}>
              {session?.name || "Open Studio"}
            </Link>
          ) : (
            <Link className="sign-in" href="/auth">
              Sign in
            </Link>
          )}

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

          <a className="cta anim" style={{ "--d": "0.4s" } as React.CSSProperties} href="/studio" onClick={goStudio}>
            {signedIn ? "Open studio" : "Launch the studio"}
          </a>
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

        <section id="pricing" className="pricing">
          <div className="pricing-head">
            <p className="pricing-eyebrow">Pricing</p>
            <h2 className="pricing-title">Simple pricing, serious output.</h2>
            <p className="pricing-sub">
              Start free. Upgrade when the gold rush starts. No uploads, no
              lock-in — everything renders in your browser.
            </p>
          </div>

          <div className="pricing-grid">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`price-card${tier.featured ? " featured" : ""}`}>
                {tier.badge && <span className="price-badge">{tier.badge}</span>}
                <p className="price-name">{tier.name}</p>
                <div className="price-amount">
                  <span className="price-num">{tier.price}</span>
                  <span className="price-per">{tier.per}</span>
                </div>
                <p className="price-desc">{tier.desc}</p>
                <ul className="price-features">
                  {tier.features.map((f) => (
                    <li key={f}>
                      <span className="price-check" aria-hidden>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a className="price-cta" href="/auth" onClick={goStudio}>
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="pricing-note">
            All plans run 100% in your browser — no uploads, no waiting.
          </p>
        </section>
      </div>

      <div
        id="mobile-menu"
        className="menu-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <nav ref={sheetRef} className="menu-sheet" aria-label="Mobile">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              className="menu-link"
              style={{ "--d": `${0.03 + i * 0.05}s` } as React.CSSProperties}
              onClick={(e) => {
                setOpen(false);
                if (link.href === "/studio") goStudio(e);
              }}
            >
              {link.label}
            </a>
          ))}
          {signedIn ? (
            <a className="menu-signin" href="/studio" onClick={(e) => { setOpen(false); goStudio(e); }}>
              {session?.name || "Open Studio"}
            </a>
          ) : (
            <Link className="menu-signin" href="/auth" onClick={() => setOpen(false)}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
      </div>
    </>
  );
}
