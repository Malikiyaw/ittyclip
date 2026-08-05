# ittyclip Landing Elevation — Progress Tracker

## Steps 1-6 ✅ Complete
1. ✅ globals.css — design tokens, easings, marquee keyframes, spotlight utility
2. ✅ lib/split.ts, lib/useMedia.ts, lib/useReducedMotion.ts, lib/anim.ts
3. ✅ Reveal.tsx — upgraded animation API + SplitText (fixed missing brace + ref type)
4. ✅ Hero3D.tsx — interactive 3D hero (replaces HeroCanvas)
5. ✅ HeroCopy.tsx — split-text headline + staggered entrance
6. ✅ Hero.tsx — composes HeroCopy + Hero3D (fixed borderDasharray TS error)

## Steps 7-9 ✅ Complete
7. ✅ Nav.tsx — scroll progress bar, mobile menu overlay, cursor attrs
8. ✅ Features.tsx — asymmetric layout, spotlight tilt, scroll stagger
9. ✅ StatsStrip.tsx — uses StatsCounter + dividing-line reveal
   - ✅ New: StatsCounter.tsx

## Steps 10-13 ✅ Complete
10. ✅ TestimonialMarquee.tsx created; Testimonials.tsx re-exports it
11. ✅ CTAVideo.tsx + FooterParallax.tsx created; CTA.tsx re-exports them
12. ✅ EditorialSplit.tsx + PinnedSection.tsx + ParallaxImage.tsx created
13. ✅ Pricing.tsx upgraded (hover glow, spotlight, animated ribbon)

## Steps 14-15 ✅ Complete
14. ✅ Integrated all new sections into app/page.tsx (Hero3D, TestimonialMarquee, CTAVideo, FooterParallax, EditorialSplit + ParallaxImage)
15. ✅ Added deps (framer-motion, @gsap/react, @fontsource/*); self-hosted fonts in layout.tsx
    - ✅ Created next-env.d.ts (was missing — caused CSS import errors)
    - ✅ Fixed dynamic import for BackgroundShader (named export)
    - ✅ Fixed useRef<number>() in BackgroundShader.tsx
    - ✅ Reworked ConnectionLines in Pipeline3D.tsx to use `<primitive>` (avoided SVG `<line>` type conflict) + removed unsupported Environment `intensity` prop
    - ✅ `tsc --noEmit` clean

## Remaining Steps
- [ ] 16. Run dev verify; test reduced-motion + mobile
