import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { Showcase } from "@/components/landing/Showcase";
import { HorizontalShowcase } from "@/components/landing/HorizontalShowcase";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pipeline3D } from "@/components/landing/Pipeline3D";
import { StatsStrip } from "@/components/landing/StatsStrip";
import { Presets } from "@/components/landing/Presets";
import { Pricing } from "@/components/landing/Pricing";
import { TestimonialMarquee } from "@/components/landing/TestimonialMarquee";
import { CTAVideo } from "@/components/landing/CTAVideo";
import { FooterParallax } from "@/components/landing/FooterParallax";
import { EditorialSplit } from "@/components/landing/EditorialSplit";
import { ParallaxImage } from "@/components/landing/ParallaxImage";

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Marquee />
      <Showcase />
      <HorizontalShowcase />
      <Features />
      <HowItWorks />
      <Pipeline3D />

      {/* Editorial split with parallax visual */}
      <EditorialSplit
        id="editorial"
        eyebrow="REFRA MED"
        title={
          <>
            Every frame scored.{" "}
            <span className="text-gradient">Every second accounted for.</span>
          </>
        }
        body="The engine listens for speech bursts, silence, and energy spikes — then ranks every moment on retention math. The result: a timeline of your best 8 to 45 second clips, ready to ship."
        reverse
        visual={
          <ParallaxImage
            src="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=1200&auto=format&fit=crop"
            alt="Video editing timeline on a dark screen"
            className="aspect-[4/3] rounded-3xl border border-line"
            speed={0.15}
          />
        }
      />

      <StatsStrip />
      <Presets />
      <Pricing />
      <TestimonialMarquee />
      <CTAVideo />
      <FooterParallax />
    </main>
  );
}
