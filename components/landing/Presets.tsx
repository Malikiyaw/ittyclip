import { Reveal } from "@/components/landing/Reveal";
import { SectionHeading } from "@/components/landing/SectionHeading";

const PRESETS = [
  { name: "TikTok", aspect: "9:16", res: "1080×1920", max: "10 min", note: "auto-fill 3-sec hook" },
  { name: "Instagram Reels", aspect: "9:16", res: "1080×1920", max: "90 sec", note: "cover crop guide" },
  { name: "YouTube Shorts", aspect: "9:16", res: "1080×1920", max: "60 sec", note: "seamless loop" },
  { name: "X / Twitter", aspect: "16:9", res: "1920×1080", max: "2:20", note: "open-caption style" },
  { name: "Twitch Clip", aspect: "16:9", res: "1280×720", max: "60 sec", note: "overlay-safe zone" },
  { name: "Podcast Cut", aspect: "1:1", res: "1080×1080", max: "3 min", note: "waveform accent" },
];

export function Presets() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-28">
      <SectionHeading
        eyebrow="PLATFORM PRESETS"
        title="One click per platform. Perfect specs every time."
        sub="Resolutions, aspect, max lengths and caption positioning — pre-tuned for every feed, so your clips never get mangled by a crop."
      />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRESETS.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.05}>
            <div className="glass group rounded-2xl p-6 transition-all duration-500 hover:ring-glow">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">{p.name}</h3>
                <span className="rounded-md bg-brand/15 px-2 py-1 font-mono text-xs font-semibold text-brand2">{p.aspect}</span>
              </div>
              <div className="mt-4 flex items-center gap-4 font-mono text-xs text-mute">
                <span>{p.res}</span>
                <span className="text-line">|</span>
                <span>max {p.max}</span>
              </div>
              <p className="mt-3 text-sm text-mute">{p.note}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
