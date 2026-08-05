import { Reveal } from "@/components/landing/Reveal";
import { SectionHeading } from "@/components/landing/SectionHeading";

const STEPS = [
  {
    n: "01",
    title: "Drop your long video",
    body: "Any format. Any length. It never leaves your machine — the whole pipeline runs in your browser on WebAssembly.",
    tags: ["drag & drop", "local-only", "no upload"],
  },
  {
    n: "02",
    title: "The engine hunts your gold",
    body: "Energy maps, silence graphs and speech-density scoring surface your 6 best moments with predicted retention scores. Take all six, or tell it to dig deeper.",
    tags: ["audio analytics", "60fps scan", "score 0–100"],
  },
  {
    n: "03",
    title: "Caption. Crop. Export. Ship.",
    body: "Word-perfect captions in one paste, six aspect ratios with smart reframe, then a real ffmpeg encode right in the tab. Your clip is live before Opus finishes uploading.",
    tags: ["ffmpeg.wasm", "9:16 / 1:1 / 4:5", "mp4 + webm + SRT"],
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative border-y border-line bg-panel/30 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title="From 84 minutes to 30 seconds in three steps"
          sub="No timeline jiu-jitsu. No render farm. The studio does the heavy lifting before your coffee gets cold."
        />
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="group relative h-full">
                {i < 2 && (
                  <div
                    className="absolute top-10 left-full z-0 hidden h-px w-10 bg-gradient-to-r from-brand/60 to-brand2/60 lg:block"
                    aria-hidden
                  />
                )}
                <div className="glass relative z-10 flex h-full flex-col rounded-3xl p-8 transition-transform duration-500 group-hover:-translate-y-1.5">
                  <span className="font-display text-6xl font-bold text-transparent [-webkit-text-stroke:1.5px_rgba(124,92,255,0.55)]">
                    {s.n}
                  </span>
                  <h3 className="font-display mt-5 text-xl font-bold">{s.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-mute">{s.body}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {s.tags.map((t) => (
                      <span key={t} className="rounded-full border border-line bg-panel px-3 py-1 font-mono text-[10px] text-brand2">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
