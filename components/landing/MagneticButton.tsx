"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";

export function MagneticButton({
  children,
  href,
  onClick,
  className = "",
  strength = 0.35,
  type,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  strength?: number;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLElement | null>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * strength;
    const y = (e.clientY - r.top - r.height / 2) * strength;
    gsap.to(el, { x, y, duration: 0.4, ease: "power3.out" });
  };
  const onLeave = () => {
    if (ref.current) gsap.to(ref.current, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.35)" });
  };

  const shared = { ref, onMouseMove: onMove, onMouseLeave: onLeave, className };

  if (href) {
    return (
      <Link href={href} {...(shared as object)}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick} type={type ?? "button"} className={className}>
      {children}
    </button>
  );
}
