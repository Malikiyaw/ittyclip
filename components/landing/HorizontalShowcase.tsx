"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    n: "01",
    title: "Highlight Hunting",
    body: "Energy maps, silence graphs and speech-density scoring surface your 6 best moments with predicted retention scores.",
    align: "top",
  },
  {
    n: "02",
    title: "Word-Perfect Captions",
    body: "Karaoke-style word highlighting, 97 languages, six signature styles, per-word timing you can hand-tune.",
    align: "center",
  },
  {
    n: "03",
    title: "6 Ratios, One Click",
    body: "9:16, 1:1, 4:5, 16:9, 21:9, 3:4 — smart reframing keeps faces centered.",
    align: "bottom",
  },
  {
    n: "04",
    title: "Export & Ship",
    body: "Real ffmpeg encode in the tab. Your clip is live before competitors finish uploading.",
    align: "top",
  },
];

const DEPTH_LAYERS = [
  { speed: -0.15, offset: "5%" },
  { speed: 0.3, offset: "-5%" },
  { speed: 0.6, offset: "0%" },
];

function useReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HorizontalShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const items = trackRef.current?.querySelectorAll(".hs-card");
      if (!items || !containerRef.current) return;

      const totalWidth = trackRef.current!.scrollWidth;
      const viewportWidth = containerRef.current.offsetWidth;
      const maxPan = Math.max(0, totalWidth - viewportWidth);

      if (maxPan === 0) return;

      if (!reduced) {
        items.forEach((card, i) => {
          const layers = card.querySelectorAll(".hs-layer");
          layers.forEach((layer) => {
            const speed = parseFloat(layer.getAttribute("data-speed") || "1");
            if (Math.abs(speed) > 0.001) {
              gsap.fromTo(
                layer,
                { x: 0 },
                {
                  x: speed * maxPan,
                  ease: "none",
                  scrollTrigger: {
                    trigger: containerRef.current!,
                    start: "top top",
                    end: `+=${maxPan}`,
                    scrub: true,
                    anticipatePin: 1,
                  },
                }
              );
            }
          });
        });
      }

      const pin = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top 80%",
        end: `+=${maxPan + viewportWidth * 0.2}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
      });

      if (!reduced) {
        gsap.to(trackRef.current, {
          x: -maxPan,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            end: `+=${maxPan}`,
            scrub: true,
            anticipatePin: 1,
          },
        });
      }

      return () => {
        ScrollTrigger.getAll().forEach((st) => st.kill());
      };
    }, containerRef);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={containerRef}
      id="process"
      className="relative mx-auto max-w-7xl overflow-hidden py-24 md:py-32"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/80 via-transparent to-ink/90" aria-hidden />

      <div className="relative z-10 mb-16 px-6">
        <div className="chip mb-6 uppercase tracking-[0.22em]">THE ENGINE</div>
        <h2 className="font-display max-w-3xl text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl md:text-6xl">
          From 84 minutes to 30 seconds <span className="text-gradient">in four passes</span>
        </h2>
      </div>

      <div ref={trackRef} className="relative flex h-[620px] items-center gap-8 px-6 pb-20">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="hs-card relative flex h-[520px] w-[380px] shrink-0 flex-col justify-end overflow-hidden rounded-3xl border border-line"
            style={{ aspectRatio: "380/520" }}
          >
            {DEPTH_LAYERS.map((layer, li) => (
              <div
                key={li}
                data-speed={layer.speed}
                className="hs-layer absolute inset-0"
                style={{
                  transform: `translateY(${layer.offset})`,
                  zIndex: li,
                }}
              >
                <div
                  className="absolute inset-0 rounded-3xl border border-line/30 bg-gradient-to-br opacity-40"
                  style={{
                    backgroundImage: `linear-gradient(135deg, hsl(${250 + i * 30}, 75%, 35%), hsl(${230 + i * 20}, 85%, 20%))`,
                  }}
                />
                <div
                  className="absolute -inset-3 rounded-full blur-[100px]"
                  style={{
                    backgroundImage: `linear-gradient(135deg, hsla(${250 + i * 30}, 75%, 55%, 0.35), hsla(${230 + i * 20}, 85%, 40%, 0.25), transparent 70%)`,
                  }}
                />
              </div>
            ))}

            <div className="relative z-10 border-t border-line/30 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8 pt-12">
              <span className="font-display text-5xl font-bold text-transparent [-webkit-text-stroke:1.5px_rgba(124,92,255,0.35)]">
                {s.n}
              </span>
              <h3 className="font-display mt-4 text-2xl font-bold text-white">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mute/80">{s.body}</p>
            </div>
          </div>
        ))}

        <div
          className={`hs-card relative flex h-[520px] w-[380px] shrink-0 flex-col justify-center rounded-3xl border border-line p-8 ${
            reduced ? "" : "group"
          }`}
        >
          {!reduced && (
            <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-hot/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          )}
          <div className="relative z-10">
            <span className="font-display text-5xl font-bold text-transparent [-webkit-text-stroke:1.5px_rgba(124,92,255,0.35)]">
              05
            </span>
            <h3 className="font-display mt-4 text-2xl font-bold text-white">You decide the pace</h3>
            <p className="mt-3 text-sm leading-relaxed text-mute/80">
              Every highlight is scored and editable. Keep, trim, merge, or let it ride. Your call.
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-8 px-6 text-center font-mono text-xs tracking-widest text-mute/60">
        scroll to scrub through the pipeline →
      </div>
    </section>
  );
}
