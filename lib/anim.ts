"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export type Easing =
  | "power2.out"
  | "power3.out"
  | "power4.out"
  | "expo.out"
  | "elastic.out"
  | "none";

export interface RevealOptions {
  delay?: number;
  y?: number;
  duration?: number;
  ease?: Easing;
  once?: boolean;
  start?: string;
}

export interface ScrollTriggerOptions {
  trigger: Element | string;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  once?: boolean;
  pin?: boolean | string;
  pinSpacing?: boolean;
  anticipatePin?: number;
  onUpdate?: (self: ScrollTrigger) => void;
}

/**
 * Creates a ScrollTrigger and returns a cleanup function.
 */
export function withScrollTrigger(
  target: Element | null,
  opts: ScrollTriggerOptions
): () => void {
  if (!target) return () => {};

  const st = ScrollTrigger.create({
    trigger: target,
    start: opts.start ?? "top 80%",
    end: opts.end,
    scrub: opts.scrub,
    once: opts.once,
    pin: opts.pin,
    pinSpacing: opts.pinSpacing,
    anticipatePin: opts.anticipatePin,
    onUpdate: opts.onUpdate,
  });

  return () => st.kill();
}

/**
 * Applies data-speed parallax to child layers within a container.
 * Each layer with [data-speed] will translate horizontally based on scroll progress.
 */
export function parallaxLayers(
  container: Element | null,
  maxPan: number
): () => void {
  if (!container) return () => {};

  const layers = container.querySelectorAll<HTMLElement>("[data-speed]");
  const cleanups: (() => void)[] = [];

  layers.forEach((layer) => {
    const speed = parseFloat(layer.getAttribute("data-speed") || "1");
    if (Math.abs(speed) < 0.001) return;

    const tween = gsap.fromTo(
      layer,
      { x: 0 },
      {
        x: speed * maxPan,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: `+=${maxPan}`,
          scrub: true,
          anticipatePin: 1,
        },
      }
    );
    cleanups.push(() => tween.scrollTrigger?.kill());
    cleanups.push(() => tween.kill());
  });

  return () => cleanups.forEach((fn) => fn());
}

/**
 * Pins a section for scroll-scrubbed animation.
 */
export function pinSection(
  trigger: Element | null,
  opts: { end: string; start?: string; pinSpacing?: boolean }
): () => void {
  if (!trigger) return () => {};

  const st = ScrollTrigger.create({
    trigger,
    start: opts.start ?? "top 80%",
    end: opts.end,
    pin: true,
    pinSpacing: opts.pinSpacing ?? true,
    anticipatePin: 1,
  });

  return () => st.kill();
}

/**
 * Refreshes all ScrollTriggers — useful after images/fonts load or resize.
 */
export function refreshScrollTriggers() {
  ScrollTrigger.refresh();
}
