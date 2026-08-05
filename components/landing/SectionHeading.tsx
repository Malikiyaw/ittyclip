import { Reveal, WordReveal } from "@/components/landing/Reveal";

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  const alignCls = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <Reveal className={`flex flex-col ${alignCls} gap-4`}>
      <span className="chip uppercase tracking-[0.22em]">{eyebrow}</span>
      <h2 className="font-display max-w-3xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl md:text-6xl">
        <WordReveal text={title} />
      </h2>
      {sub && <p className="max-w-2xl text-base text-mute sm:text-lg">{sub}</p>}
    </Reveal>
  );
}
