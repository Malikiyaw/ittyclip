# Implementation Plan

**Overview**
Transform the ittyclip landing experience into a bespoke, cinematic, Awwwards-caliber website with real 3D, scroll choreography, editorial asymmetric layout, and premium micro-interactions — eliminating every "vibecoded" pattern (centered gradient-blob heroes, default purple→blue gradients, uniform card grids, plain fade-in motions).

This plan elevates the existing React Three Fiber + GSAP + Lenis foundation into a disciplined, art-directed experience. The studio app remains untouched except for a shared design-token polish pass. The implementation pushes the existing 3D/shader work further (interactive scroll-tied camera, scroll choreography, split-text, custom easing, editorial asymmetric layouts, art-directed typography/color) while honoring `prefers-reduced-motion`, accessibility, and performance discipline.

---

## Types

Introduce new shared types for the elevated animation + design system.

- `src/lib/anim.ts` — new animation utility types:
  - `type Easing = "power2.out" | "power3.out" | "power4.out" | "expo.out" | "elastic.out" | "none"`
  - `interface RevealOptions { delay?: number; y?: number; duration?: number; ease?: Easing; once?: boolean; start?: string }`
  - `interface SplitChar { el: HTMLElement; char: string }`
  - `interface SplitWord { el: HTMLSpanElement; word: string; chars: SplitChar[] }`
  - `interface SplitResult { words: SplitWord[]; chars: SplitChar[]; container: HTMLElement }`
- `src/lib/split.ts` — DOM split utility returning `SplitResult` for split-text reveals.
- `src/lib/useMedia.ts` — `useMediaQuery(query: string): boolean` hook (replaces inline `matchMedia` checks).
- `src/lib/useReducedMotion.ts` — consolidated reduced-motion hook.

---

## Files

Modify the existing Next.js 15 App Router landing experience. New files created, existing files enhanced.

### New Files

1. `ittyclip-main/lib/split.ts`
   - Purpose: Split text into word/char spans with overflow-hidden wrappers for staggered reveals.
   - Exports: `splitText(el: HTMLElement, opts?: { preserveWhitespace?: boolean }): SplitResult`
   - Handles reduced-motion by returning unsplit text.

2. `ittyclip-main/lib/useMedia.ts`
   - Purpose: SSR-safe media query hook.
   - Exports: `useMedia(query: string): boolean`

3. `ittyclip-main/lib/useReducedMotion.ts`
   - Purpose: SSR-safe `prefers-reduced-motion` hook.
   - Exports: `useReducedMotion(): boolean`

4. `ittyclip-main/components/landing/Hero3D.tsx`
   - Purpose: Replaces `HeroCanvas.tsx` with a dramatically upgraded interactive 3D hero scene.
   - Key features:
     - Scroll-tied camera dolly + parallax (camera moves z/y on scroll progress)
     - Mouse-reactive camera rig with lerp smoothing
     - 3 floating "clip" cards with procedural canvas textures (existing shader approach, upgraded)
     - Particle field with custom GLSL shader (existing, refined)
     - A central "golden" hero clip that reacts to hover (scale, emissive pulse)
     - Environment lighting + contact shadows
     - Lazy-loaded, mobile caps (reduced particles, no postprocessing on low-end)
     - 2D fallback poster when WebGL unavailable
   - Exports: `default Hero3D({ mobile }: { mobile: boolean })`

5. `ittyclip-main/components/landing/HeroCopy.tsx`
   - Purpose: Cinematic hero headline with split-text character reveal + staggered load-in.
   - Uses `splitText` + GSAP timeline with `clip-path`, `translateY`, `rotateX` entrance.
   - Exports: `HeroCopy()`

6. `ittyclip-main/components/landing/PinnedSection.tsx`
   - Purpose: Reusable pinned scroll-scrubbed section wrapper.
   - Props: `{ children, id, trigger, start, end, pinSpacing }`
   - Uses GSAP ScrollTrigger `pin` + `scrub`.
   - Exports: `PinnedSection()`

7. `ittyclip-main/components/landing/ParallaxImage.tsx`
   - Purpose: Art-directed parallax image block with `data-speed` layers.
   - Exports: `ParallaxImage({ src, alt, className, speed })`

8. `ittyclip-main/components/landing/EditorialSplit.tsx`
   - Purpose: Asymmetric editorial two-column layout (sticky left text, scrolling right visual).
   - Exports: `EditorialSplit({ eyebrow, title, body, visual, reverse })`

9. `ittyclip-main/components/landing/StatsCounter.tsx`
   - Purpose: Enhanced animated counter with scroll-triggered count-up + suffix/prefix, `Intl.NumberFormat`.
   - Exports: `StatsCounter({ value, suffix, label, decimals })`

10. `ittyclip-main/components/landing/TestimonialMarquee.tsx`
    - Purpose: Infinite marquee of testimonial cards (replaces static masonry grid) — two rows scrolling opposite directions.
    - Exports: `TestimonialMarquee()`

11. `ittyclip-main/components/landing/FooterParallax.tsx`
    - Purpose: Footer with parallax background layers and giant outlined "ittyclip" wordmark.
    - Exports: `FooterParallax()`

12. `ittyclip-main/components/landing/CTAVideo.tsx`
    - Purpose: CTA section with subtle animated video/gradient canvas background + magnetic buttons.
    - Exports: `CTAVideo()`

### Modified Files

1. `ittyclip-main/app/page.tsx`
   - Replace `Hero` with `HeroCopy` + `Hero3D`; reorder sections; add `EditorialSplit`, `TestimonialMarquee`, `FooterParallax`, `CTAVideo`.
   - Keep `Nav`, `Marquee`, `Showcase`, `HorizontalShowcase`, `Features`, `HowItWorks`, `Pipeline3D`, `StatsStrip`, `Presets`, `Pricing`.

2. `ittyclip-main/components/landing/Hero.tsx`
   - Replace with the new `HeroCopy` + `Hero3D` composition (keep the `#hero` section id and reduced-motion handling).

3. `ittyclip-main/components/landing/HeroCanvas.tsx`
   - Refactor into `Hero3D.tsx` (new file). Keep as wrapper for backward compat or delete.

4. `ittyclip-main/components/landing/Nav.tsx`
   - Add scroll-progress bar (GSAP ScrollTrigger `scrub`).
   - Add mobile menu overlay with staggered link reveal.
   - Add `data-cursor` attributes for cursor interaction.

5. `ittyclip-main/components/landing/Reveal.tsx`
   - Upgrade `Reveal` to support `clip-path`, `rotateX`, `scale` entrance options.
   - Add `SplitText` component wrapping `splitText` utility for char/word reveals.

6. `ittyclip-main/components/landing/Features.tsx`
   - Convert uniform 3-col grid to asymmetric editorial layout (2 large + 4 small, staggered offset).
   - Add hover 3D tilt (existing) + spotlight glow following cursor (upgrade).
   - Add scroll-triggered stagger per card.

7. `ittyclip-main/components/landing/StatsStrip.tsx`
   - Use `StatsCounter` component; add scroll-triggered count-up with easing.
   - Add a dividing-line reveal animation.

8. `ittyclip-main/components/landing/Testimonials.tsx`
   - Replace with `TestimonialMarquee` (two-row infinite marquee).

9. `ittyclip-main/components/landing/CTA.tsx`
   - Replace with `CTAVideo`; keep `Footer` but upgrade to `FooterParallax`.

10. `ittyclip-main/components/landing/Pricing.tsx`
    - Add hover lift + glow border following cursor; add `PinnedSection` for scroll choreography.
    - Add a "Most popular" ribbon that animates in on scroll.

11. `ittyclip-main/components/landing/BackgroundShader.tsx`
    - Refine GLSL: add mouse-reactive distortion, richer color depth, reduced alpha on mobile.
    - Add `prefers-reduced-motion` guard (already present).

12. `ittyclip-main/app/globals.css`
    - Add new design tokens: `--color-gold: #f7c948`, `--color-ink-2: #0a0c16`, `--ease-custom: cubic-bezier(0.16, 1, 0.3, 1)`.
    - Add `.text-outline` utility (text-stroke), `.spotlight-card` utility (radial gradient following cursor), `.marquee-track` keyframes.
    - Add `@keyframes marquee-reverse` for opposite-direction rows.
    - Add `scrollbar-width: thin` for Firefox.
    - Add `@media (prefers-reduced-motion: reduce)` additional guards.

13. `ittyclip-main/components/ScrollProvider.tsx`
    - Add `ScrollTrigger.refresh()` on resize/orientation change.
    - Respect reduced-motion by disabling Lenis smoothing (already done).

14. `ittyclip-main/components/landing/Cursor.tsx`
    - Add `data-cursor="hover"` expansion for interactive elements; add text-label mode (`data-cursor-label`).

---

## Functions

### New Functions

- `splitText(el: HTMLElement, opts): SplitResult` — `lib/split.ts`. Splits text nodes into word/char spans.
- `useMedia(query: string): boolean` — `lib/useMedia.ts`. SSR-safe matchMedia.
- `useReducedMotion(): boolean` — `lib/useReducedMotion.ts`. SSR-safe.
- `withScrollTrigger(target, opts): () => void` — `lib/anim.ts`. Creates a ScrollTrigger and returns cleanup.
- `parallaxLayers(container, layers, maxPan): () => void` — `lib/anim.ts`. Applies `data-speed` parallax to child layers.
- `pinSection(trigger, opts): () => void` — `lib/anim.ts`. Wraps ScrollTrigger pin creation.

### Modified Functions

- `Reveal` component in `Reveal.tsx` — add `clipPath`, `rotateX`, `scale`, `ease`, `start` props.
- `WordReveal` in `Reveal.tsx` — use `splitText` utility; add `stagger`, `rotateX`, `clipPath` options.
- `Hero` in `Hero.tsx` — replace with `HeroCopy` composition.
- `HeroCanvas` in `HeroCanvas.tsx` — refactor into `Hero3D`.
- `FeatureCard` in `Features.tsx` — add spotlight glow following cursor.
- `Stat` in `StatsStrip.tsx` — replace with `StatsCounter`.
- `Footer` in `CTA.tsx` — replace with `FooterParallax`.

### Removed Functions

- `Hero` (old) — replaced by `HeroCopy` composition.
- `Testimonials` masonry grid — replaced by `TestimonialMarquee`.
- `CTA` old section — replaced by `CTAVideo`.
- `Footer` old — replaced by `FooterParallax`.

---

## Classes

No new TypeScript classes introduced. All logic remains functional + hooks. The `Reveal` and `WordReveal` components are upgraded to support the new animation API.

---

## Dependencies

Add `framer-motion` (currently not in `package.json`) for additional timeline/choreography micro-interactions where GSAP is less ergonomic. Add `@gsap/react` for `useGSAP` hook (cleaner context management) — optional but recommended. Add `@fontsource/space-grotesk` + `@fontsource/inter` to self-host fonts (removes Google Fonts network dependency, improves performance). No other new packages.

- `npm install framer-motion @gsap/react @fontsource/space-grotesk @fontsource/inter`

---

## Testing

Manual + automated verification of landing page sections, animation behavior, reduced-motion, accessibility, and performance.

- **Manual**: Scroll through every section; verify all links/buttons; test hover states, magnetic buttons, cursor, 3D hero on desktop + mobile; test `prefers-reduced-motion`; verify keyboard navigation.
- **Automated**: `npm run typecheck` must pass. Verify no console errors during dev.
- **Performance**: Check Lighthouse performance score; ensure 3D lazy-loads and mobile caps are active.

---

## Implementation Order

1. Add design tokens + utilities to `globals.css` (colors, easings, marquee keyframes, spotlight utility).
2. Create `lib/split.ts`, `lib/useMedia.ts`, `lib/useReducedMotion.ts`, `lib/anim.ts` utility modules.
3. Upgrade `Reveal.tsx` (new animation API + `SplitText` component).
4. Refactor `HeroCanvas.tsx` → `Hero3D.tsx` (interactive camera, upgraded shaders, mobile caps).
5. Create `HeroCopy.tsx` (split-text headline + staggered entrance).
6. Update `Hero.tsx` to compose `HeroCopy` + `Hero3D`.
7. Upgrade `Nav.tsx` (scroll progress bar, mobile menu, cursor attrs).
8. Upgrade `Features.tsx` (asymmetric layout, spotlight tilt).
9. Upgrade `StatsStrip.tsx` (use `StatsCounter`).
10. Create `TestimonialMarquee.tsx`; replace `Testimonials.tsx`.
11. Create `CTAVideo.tsx` + `FooterParallax.tsx`; replace `CTA.tsx`.
12. Create `EditorialSplit.tsx` + `PinnedSection.tsx` + `ParallaxImage.tsx`; integrate into `page.tsx`.
13. Upgrade `Pricing.tsx` (hover glow, pinned scroll).
14. Integrate all sections into `app/page.tsx` with correct order.
15. Add `framer-motion`, `@gsap/react`, `@fontsource/*`; update `layout.tsx` to self-host fonts.
16. Run `npm run typecheck`, fix errors; run `npm run dev`, manually verify; test reduced-motion + mobile.
