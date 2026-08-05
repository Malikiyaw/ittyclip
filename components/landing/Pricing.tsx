"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Reveal } from "@/components/landing/Reveal";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { MagneticButton } from "@/components/landing/MagneticButton";

gsap.registerPlugin(ScrollTrigger);

const PLANS = [
  {
    name: "Free",
    price: 0,
    tagline: "Feel the power. Zero cost.",
    features: ["3 clips per month", "720p exports", "Core caption styles", "SRT export", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Creator",
    price: 19,
    tagline: "The daily clip machine.",
    features: [
      "Unlimited clips",
      "1080p + webm exports",
      "All 6 caption styles + custom fonts",
      "AI hook writer & thumbnails",
      "Batch repurpose",
      "Brand kit · 1 workspace",
    ],
    cta: "Go Creator",
    highlight: true,
  },
  {
    name: "Studio",
    price: 49,
    tagline: "For teams shipping daily.",
    features: [
      "Everything in Creator",
      "4K exports, watermark-free",
      "5 team seats + roles",
      "Shared brand kits",
      "API access & webhooks",
      "Priority engine speed",
    ],
    cta: "Go Studio",
    highlight: false,
  },
];

function PricingCard({ p, yearly, index }: { p: (typeof PLANS)[number]; yearly: boolean; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const ribbonRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Hover lift + glow border
      el.addEventListener("mousemove", (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--spot-x", `${px}%`);
        el.style.setProperty("--spot-y", `${py}%`);
      });
    }, el);

    // Animate "Most popular" ribbon in on scroll
    if (p.highlight && ribbonRef.current) {
      const ribbon = ribbonRef.current;
      gsap.fromTo(
        ribbon,
        { y: -30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "back.out(1.7)",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        }
      );
    }

    return () => ctx.revert();
  }, [p.highlight]);

  const price = yearly ? Math.round(p.price * 0.7) : p.price;

  return (
    <Reveal delay={index * 0.08}>
      <div
        ref={ref}
        className={`pricing-card spotlight-card group relative flex h-full flex-col rounded-3xl p-8 transition-transform duration-500 hover:-translate-y-2 ${
          p.highlight ? "bg-gradient-to-b from-brand/25 via-panel to-panel ring-glow" : "glass"
        }`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Cursor-follow spotlight glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(500px circle at var(--spot-x,50%) var(--spot-y,50%), rgba(124,92,255,0.15), transparent 45%)",
          }}
          aria-hidden
        />

        {p.highlight && (
          <span
            ref={ribbonRef}
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand to-hot px-4 py-1 font-mono text-[10px] font-bold tracking-widest text-white uppercase shadow-[0_0_20px_rgba(124,92,255,0.5)]"
          >
            Most popular
          </span>
        )}
        <h3 className="font-display text-lg font-bold">{p.name}</h3>
        <p className="mt-1 text-sm text-mute">{p.tagline}</p>
        <div className="mt-6 flex items-end gap-1.5">
          <span className="font-display text-5xl font-bold">${price}</span>
          <span className="pb-1.5 text-sm text-mute">/mo</span>
        </div>
        <ul className="mt-7 flex-1 space-y-3">
          {p.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-mute">
              <span className="mt-0.5 text-brand2" aria-hidden>
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>
        <MagneticButton
          href="/studio"
          className={`mt-8 rounded-full py-3.5 text-center font-display text-sm font-semibold ${
            p.highlight ? "btn-primary text-white" : "glass text-fg"
          }`}
        >
          {p.cta}
        </MagneticButton>
      </div>
    </Reveal>
  );
}

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="relative mx-auto max-w-7xl px-6 py-28">
      <SectionHeading
        eyebrow="PRICING"
        title="Pay for clips, not for cloud"
        sub="Because everything runs on your hardware, our margins are tiny — so yours stay huge."
      />

      <Reveal className="mt-10 flex items-center justify-center gap-4">
        <span className={`text-sm ${!yearly ? "text-fg" : "text-mute"}`}>Monthly</span>
        <button
          onClick={() => setYearly((y) => !y)}
          className="relative h-7 w-14 rounded-full border border-line bg-panel transition-colors"
          role="switch"
          aria-checked={yearly}
          aria-label="Toggle yearly billing"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-gradient-to-br from-brand to-brand2 shadow-[0_0_12px_rgba(124,92,255,0.6)] transition-all duration-300 ${
              yearly ? "left-8" : "left-1"
            }`}
          />
        </button>
        <span className={`text-sm ${yearly ? "text-fg" : "text-mute"}`}>
          Yearly <span className="ml-1 rounded-full bg-brand/20 px-2 py-0.5 font-mono text-[10px] text-brand2">-30%</span>
        </span>
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <PricingCard key={p.name} p={p} yearly={yearly} index={i} />
        ))}
      </div>
    </section>
  );
}
