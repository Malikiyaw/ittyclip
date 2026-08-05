"use client";

import { SectionHeading } from "@/components/landing/SectionHeading";

const QUOTES = [
  {
    name: "Maya R.",
    role: "1.2M followers · TikTok",
    text: "I cut my 2-hour podcast into 14 clips while my coffee was still hot. The caption styles alone made me ditch Opus.",
  },
  {
    name: "Devon K.",
    role: "Whop seller · $40k/mo",
    text: "The highlight scores are scary good. It found the exact 12 seconds where I pitch the upsell. That clip pays for the year.",
  },
  {
    name: "Alicia T.",
    role: "YouTube · 890K subs",
    text: "Everything runs locally. I edit 4K gameplay on a plane with no wifi. Try doing that with a cloud clipper.",
  },
  {
    name: "Joaquin S.",
    role: "Twitch streamer",
    text: "Auto-repurposing 30 clips of my best rage moments... my editor quit. Not even joking.",
  },
  {
    name: "Priya N.",
    role: "Course creator",
    text: "I teach in English, sell in 8 languages. Burned SRT captions in 6 languages from one upload. Wild.",
  },
  {
    name: "Cole W.",
    role: "Agency · 40+ clients",
    text: "Brand kits + shared workspaces means my juniors ship on-brand clips without me reviewing a single crop.",
  },
];

const ROW_A = QUOTES.slice(0, 3);
const ROW_B = QUOTES.slice(3);

function TestimonialCard({ q }: { q: (typeof QUOTES)[number] }) {
  return (
    <figure className="glass w-[320px] shrink-0 snap-start rounded-2xl p-6 transition-colors duration-500 hover:border-brand/40 sm:w-[380px]">
      <div className="mb-3 flex gap-1 text-hot" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, s) => (
          <span key={s} aria-hidden>
            ★
          </span>
        ))}
      </div>
      <blockquote className="text-sm leading-relaxed text-fg/90">“{q.text}”</blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-hot font-display text-sm font-bold text-white">
          {q.name[0]}
        </span>
        <span>
          <span className="block text-sm font-semibold">{q.name}</span>
          <span className="block text-xs text-mute">{q.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function MarqueeRow({ items, reverse = false }: { items: typeof QUOTES; reverse?: boolean }) {
  return (
    <div className="marquee-row relative overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)" }}>
      <div
        className={`flex w-max gap-5 py-2 ${reverse ? "marquee-row-reverse" : ""}`}
        aria-hidden={reverse}
      >
        {[...items, ...items, ...items].map((q, i) => (
          <TestimonialCard key={`${q.name}-${i}`} q={q} />
        ))}
      </div>
    </div>
  );
}

export function TestimonialMarquee() {
  return (
    <section className="relative overflow-hidden border-t border-line bg-panel/30 py-28">
      <div className="mx-auto mb-14 max-w-7xl px-6">
        <SectionHeading
          eyebrow="CREATORS"
          title="12,400+ creators already shipped"
          sub="The funniest reviews come from people who just made their first 3x week."
        />
      </div>
      <div className="flex flex-col gap-5">
        <MarqueeRow items={ROW_A} />
        <MarqueeRow items={ROW_B} reverse />
      </div>
    </section>
  );
}
