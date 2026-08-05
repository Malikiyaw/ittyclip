const PLATFORMS = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "Twitch",
  "X / Twitter",
  "Podcasts",
  "LinkedIn",
  "Substack",
  "OnlyFans",
  "Whop",
  "Discord",
  "WhatsApp Status",
];

export function Marquee() {
  const row = [...PLATFORMS, ...PLATFORMS];
  return (
    <section className="relative border-y border-line bg-panel/40 py-6" aria-label="Supported platforms">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-ink to-transparent" />
      <div className="overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-10 hover:[animation-play-state:paused]">
          {row.map((p, i) => (
            <div key={i} className="flex items-center gap-10">
              <span className="font-display whitespace-nowrap text-lg font-semibold text-mute transition-colors hover:text-fg">
                {p}
              </span>
              <span className="text-brand2" aria-hidden>
                •
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
