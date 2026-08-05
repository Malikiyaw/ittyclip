"use client";

import { useRef, useEffect } from "react";
import { Reveal } from "@/components/landing/Reveal";
import { SectionHeading } from "@/components/landing/SectionHeading";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const BIG = [
  {
    title: "Neural Highlight Hunting",
    body: "The engine maps every silence, spike and speech burst across your video, then scores each moment on retention math — the same signals Opus uses, computed locally at 60fps.",
    gradient: "from-brand/30 to-brand2/20",
    icon: "◎",
    span: "md:col-span-2",
    offset: "md:mt-10",
  },
  {
    title: "Word-Perfect Auto Captions",
    body: "Karaoke-style word highlighting, 97 languages, six signature styles, per-word timing you can hand-tune. Burn them in at export — or ship an SRT in one click.",
    gradient: "from-hot/25 to-brand/20",
    icon: "Aa",
    offset: "md:mt-0",
  },
  {
    title: "Silence & Filler Eraser",
    body: "\"um\", \"uh\", \"you know\" — detected, highlighted, gone. Trims 18% of your runtime on average without touching your story.",
    gradient: "from-brand2/25 to-hot/20",
    icon: "×",
    offset: "md:mt-16",
  },
  {
    title: "AI Hook Writer",
    body: "First 3 seconds decide everything. ittyclip drafts retention-tuned hooks and CTAs from your own words.",
    gradient: "from-brand/25 to-brand2/20",
    icon: "✎",
    span: "md:col-span-2",
    offset: "md:mt-6",
  },
  {
    title: "6 Aspect Ratios, One Click",
    body: "9:16, 1:1, 4:5, 16:9, 21:9, 3:4 — with smart reframing that keeps faces centered. Platform presets for TikTok, Reels, Shorts, X, Twitch.",
    gradient: "from-hot/20 to-brand/25",
    icon: "▭",
    offset: "md:mt-0",
  },
  {
    title: "Brand Kit",
    body: "Your logo, palette, fonts and watermark riding along on every export. Teams get shared kits.",
    gradient: "from-brand2/20 to-hot/20",
    icon: "♦",
    offset: "md:mt-24",
  },
];

const ALL_FEATURES = [
  "Batch repurpose — 1 video → 30 clips",
  "AI thumbnail studio",
  "Background music library with auto-ducking",
  "Auto-description & hashtag generator",
  "Speaker labeling",
  "Keyword highlight targeting",
  "One-click Polish (LUT presets)",
  "4K proxy editing, frame-accurate",
  "Smart reframe with face tracking",
  "Keyboard-first editing, 40+ shortcuts",
  "Undo everything. Version history.",
  "Team workspaces & roles",
  "API access & webhooks",
  "Offline mode — everything local",
  "Cloud sync when you want it",
  "Analytics: predicted clip scores",
  "Content calendar hooks",
  "A/B hook testing",
  "Burn-in subtitles in 97 languages",
  "Emoji & b-roll auto-enhance",
  "Voice isolation (noise floor removal)",
  "Speed-ramp preset pack",
  "Auto end-screen & CTA templates",
  "Subtitle styles you can sell",
  "Project JSON import/export",
  "In-browser encode (ffmpeg.wasm)",
  "SRT / VTT subtitle export",
  "Frame-accurate trim handles",
  "Zoom levels down to 1ms",
  "Custom export queues",
  "Watermark-free on Studio plan",
  "Screen-recorder import",
  "DRM-free local processing",
  "No credit card to start",
];

function FeatureCard({ f, i }: { f: (typeof BIG)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      // Scroll-triggered stagger entrance
      gsap.fromTo(
        el,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          delay: (i % 3) * 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );

      // Cursor-follow spotlight + 3D tilt
      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

        // Update CSS vars for spotlight
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--spot-x", `${px}%`);
        el.style.setProperty("--spot-y", `${py}%`);

        gsap.to(el, {
          rotateY: x * 4,
          rotateX: -y * 4,
          transformPerspective: 1000,
          duration: 0.5,
          ease: "power2.out",
        });

        const overlay = el.querySelector(".feature-glow") as HTMLElement;
        if (overlay) {
          gsap.to(overlay, {
            opacity: 0.5 + Math.abs(x) * 0.3,
            duration: 0.3,
            ease: "power2.out",
          });
        }
      };

      const onLeave = () => {
        gsap.to(el, {
          rotateY: 0,
          rotateX: 0,
          duration: 0.8,
          ease: "elastic.out(1, 0.3)",
        });
        const overlay = el.querySelector(".feature-glow") as HTMLElement;
        if (overlay) {
          gsap.to(overlay, { opacity: 0, duration: 0.6, ease: "power3.out" });
        }
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
    }, el);

    return () => ctx.revert();
  }, [i]);

  return (
    <div
      ref={ref}
      className={`feature-card spotlight-card relative h-full overflow-hidden rounded-3xl border border-line p-7 opacity-0 will-change-transform ${f.span ?? ""} ${f.offset ?? ""}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100 feature-glow`}
        aria-hidden
      />
      <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-brand to-brand2 opacity-0 blur-[60px] transition-opacity duration-700 group-hover:opacity-40" />
      <div className="relative">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand2 font-display text-lg font-bold text-white shadow-[0_0_24px_rgba(124,92,255,0.45)] transition-transform group-hover:rotate-6">
          {f.icon}
        </div>
        <h3 className="font-display text-xl font-bold text-fg">{f.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-mute">{f.body}</p>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl px-6 py-28">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent"
        aria-hidden
      />
      <SectionHeading
        eyebrow="30+ FEATURES"
        title="Everything Opus can do. Then everything it can't."
        sub="Opus changed the game. ittyclip rewrote the rules: real control, real speed, zero cloud dependency, and a feature count that keeps climbing every week."
      />

      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {BIG.map((f, i) => (
          <FeatureCard key={f.title} f={f} i={i} />
        ))}
      </div>

      <Reveal className="mt-10">
        <div className="glass rounded-3xl p-8">
          <p className="font-mono text-xs tracking-widest text-brand2 uppercase">The full arsenal</p>
          <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-mute">
                <span className="mt-0.5 text-brand2" aria-hidden>
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
