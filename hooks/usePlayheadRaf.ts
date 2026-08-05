"use client";

import { useEffect, useRef } from "react";
import { useStudio } from "@/store/studio";

export function usePlayheadRaf(callback: (t: number) => void) {
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = useStudio.getState().playhead;
      if (Math.abs(t - last) > 0.001) {
        last = t;
        cb.current(t);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
