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
  const [exportOpen, setExportOpen] = useState(false);
  useKeyboard();

  return (
    <div className="flex h-screen flex-col bg-ink">
      <TopBar onExport={() => setExportOpen(true)} />
      {media ? (
        <div className="flex min-h-0 flex-1">
          <MediaPanel />
          <div className="flex min-w-0 flex-1 flex-col">
            <Preview />
            <Timeline />
          </div>
        </div>
      ) : (
        <UploadZone />
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <Toast />
    </div>
  );
}
