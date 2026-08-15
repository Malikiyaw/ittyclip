"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useStudio } from "@/store/studio";
import { useAuth } from "@/store/auth";
import { fmtClock } from "@/lib/types";
import { PROJECT_EXT } from "@/lib/project";

export function TopBar({ onExport }: { onExport: () => void }) {
  const router = useRouter();
  const media = useStudio((s) => s.media);
  const clips = useStudio((s) => s.clips);
  const analyzing = useStudio((s) => s.analyzing);
  const showToast = useStudio((s) => s.showToast);
  const exportState = useStudio((s) => s.exportState);
  const canUndo = useStudio((s) => s.undoStack.length > 0);
  const canRedo = useStudio((s) => s.redoStack.length > 0);
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const fileRef = useRef<HTMLInputElement>(null);

  const signOut = () => {
    logout();
    useStudio.getState().reset();
    router.push("/");
  };

  const saveProject = () => {
    const json = useStudio.getState().exportProject();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ittyclip-project${PROJECT_EXT}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("Project saved");
  };

  const loadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text) {
        showToast("Could not read that file.");
        return;
      }
      useStudio.getState().loadProject(text);
    };
    reader.onerror = () => showToast("Could not read that file.");
    reader.readAsText(file);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-black px-5">
      <Link href="/" className="flex items-center gap-3" aria-label="ittyclip home">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_4px_16px_rgba(255,255,255,0.25)]">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M5 3.5 L13 8 L5 12.5 Z" fill="black" />
          </svg>
        </span>
        <span className="s-display text-lg text-white">
          ittyclip
        </span>
      </Link>

      <span className="h-6 w-px bg-white/10" aria-hidden />

      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-white/60">
          {media ? media.name : "no project"}
        </p>
        {media && (
          <p className="text-[10px] text-white/35">
            {fmtClock(media.duration)} · {clips.length} clip{clips.length === 1 ? "" : "s"} in timeline
            {analyzing && " · analyzing…"}
          </p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {session && (
          <span className="hidden max-w-[140px] truncate font-mono text-[10px] text-white/40 lg:inline">
            {session.name || session.email}
          </span>
        )}
        <button
          onClick={() => useStudio.getState().undo()}
          disabled={!canUndo}
          className="s-btn px-2.5 py-1.5 text-[10px]"
          aria-label="Undo (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={() => useStudio.getState().redo()}
          disabled={!canRedo}
          className="s-btn px-2.5 py-1.5 text-[10px]"
          aria-label="Redo (Ctrl+Shift+Z)"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
        {media && (
          <>
            <button onClick={saveProject} className="s-btn">
              Save project
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="s-btn"
              title="Load a saved .ittyclip project"
            >
              Load project
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".ittyclip,.json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadProject(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={onExport}
              disabled={exportState === "running" || exportState === "loading"}
              className="s-btn-solid"
            >
              {exportState === "running" ? "Exporting…" : "Export"}
            </button>
          </>
        )}
        <button onClick={signOut} className="s-btn">
          Sign out
        </button>
      </div>
    </header>
  );
}
