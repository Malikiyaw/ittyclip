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
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  useKeyboard();

  return (
    <div className="studio flex h-[100dvh] min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <TopBar onExport={() => setExportOpen(true)} />
      {media ? (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Desktop: persistent tools sidebar. Mobile: compact bottom-sheet, hidden by default
              so the user can actually see and watch the video. */}
          <aside
            className={`studio-media-sidebar order-3 min-h-0 min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-white/10 bg-[#07080d] md:order-1 md:h-full md:w-[min(380px,34vw)] md:border-r ${
              mobilePanelOpen
                ? "absolute inset-x-0 bottom-0 z-50 max-h-[68dvh] w-full rounded-t-2xl border-t shadow-[0_-24px_80px_rgba(0,0,0,0.75)]"
                : "hidden"
            } md:relative md:block md:rounded-none md:border-t-0 md:shadow-none`}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#07080d]/95 px-4 py-2.5 backdrop-blur md:hidden">
              <span className="font-mono text-[10px] tracking-[0.25em] text-white/60 uppercase">Studio tools</span>
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] text-white/75"
                aria-label="Hide studio tools"
              >
                Hide
              </button>
            </div>
            <MediaPanel onExport={() => setExportOpen(true)} />
          </aside>

          <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:order-2">
            <main className="studio-preview min-h-0 min-w-0 flex-1 overflow-hidden">
              <Preview />
            </main>
            <div className="min-w-0 shrink-0">
              <Timeline />
            </div>
          </div>

          {/* Mobile-only controls. Keep these outside the preview so they never shrink the video. */}
          <div className="absolute bottom-[4.25rem] left-1/2 z-40 flex -translate-x-1/2 md:hidden">
            <button
              type="button"
              onClick={() => setMobilePanelOpen((open) => !open)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/85 px-4 py-2.5 text-[11px] font-medium text-white shadow-[0_10px_35px_rgba(0,0,0,0.65)] backdrop-blur-xl"
              aria-expanded={mobilePanelOpen}
              aria-controls="mobile-studio-tools"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              {mobilePanelOpen ? "Hide tools" : "Edit / AI tools"}
            </button>
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
