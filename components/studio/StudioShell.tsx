"use client";

import { useState } from "react";
import { useStudio } from "@/store/studio";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TopBar } from "@/components/studio/TopBar";
import { MediaPanel } from "@/components/studio/MediaPanel";
import { Preview } from "@/components/studio/Preview";
import { Timeline } from "@/components/studio/Timeline";
import { UploadZone } from "@/components/studio/UploadZone";
import { ExportModal } from "@/components/studio/ExportModal";
import { Toast } from "@/components/studio/Toast";

export function StudioShell() {
  const media = useStudio((s) => s.media);
  const pendingProject = useStudio((s) => s.pendingProject);
  const [exportOpen, setExportOpen] = useState(false);
  useKeyboard();

  return (
    <div className="studio flex h-[100dvh] min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <TopBar onExport={() => setExportOpen(true)} />
      {media ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
          <aside className="order-3 min-h-0 min-w-0 w-full shrink-0 overflow-x-hidden overflow-y-auto border-t border-white/10 md:order-1 md:h-full md:w-[min(380px,34vw)] md:border-t-0 md:border-r">
            <MediaPanel onExport={() => setExportOpen(true)} />
          </aside>

          <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:order-2">
            <main className="min-h-[min(42dvh,420px)] min-w-0 flex-1 overflow-hidden md:min-h-0">
              <Preview />
            </main>
            <div className="min-w-0 shrink-0">
              <Timeline />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {pendingProject && (
            <div className="z-20 flex shrink-0 items-start gap-3 border-b border-white/15 bg-white/[0.06] px-4 py-2.5 backdrop-blur sm:px-5">
              <span className="text-sm" aria-hidden>📂</span>
              <p className="text-[11px] leading-relaxed text-white/80">
                <span className="font-semibold text-white">{pendingProject.project.name}</span> loaded —
                drop the original video ({pendingProject.media?.name ?? "unknown file"}) to restore your
                clips, captions, and settings.
              </p>
            </div>
          )}
          <UploadZone />
        </div>
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <Toast />
    </div>
  );
}
