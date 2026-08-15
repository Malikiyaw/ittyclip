"use client";

import { useStudio } from "@/store/studio";

export function Toast() {
  const toast = useStudio((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[90] -translate-x-1/2">
      <div className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black shadow-[0_16px_50px_rgba(0,0,0,0.7)]">
        {toast}
      </div>
    </div>
  );
}
