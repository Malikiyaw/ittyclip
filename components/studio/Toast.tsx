"use client";

import { useStudio } from "@/store/studio";

export function Toast() {
  const toast = useStudio((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[90] -translate-x-1/2">
      <div className="glass-deep rounded-full px-5 py-2.5 text-sm text-fg shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        {toast}
      </div>
    </div>
  );
}
