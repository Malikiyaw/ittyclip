"use client";

import { useEffect } from "react";
import { useStudio } from "@/store/studio";

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.isComposing) return;
      const s = useStudio.getState();
      const duration = s.media?.duration ?? 0;

      if (e.code === "Space") {
        e.preventDefault();
        s.setPlaying(!s.isPlaying);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        s.setPlayhead(Math.min(duration, s.playhead + (e.shiftKey ? 1 : 5)));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        s.setPlayhead(Math.max(0, s.playhead - (e.shiftKey ? 1 : 5)));
      } else if ((e.key === "Delete" || e.key === "Backspace") && s.activeClipId) {
        e.preventDefault();
        s.removeClip(s.activeClipId);
        s.showToast("Clip removed");
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const json = s.exportProject();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ittyclip-project.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        s.showToast("Project saved");
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        s.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
