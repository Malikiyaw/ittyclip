"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudio } from "@/store/studio";
import { useAuth } from "@/store/auth";
import { fmtClock } from "@/lib/types";

export function TopBar({ onExport }: { onExport: () => void }) {
  const router = useRouter();
  const media = useStudio((s) => s.media);
  const clips = useStudio((s) => s.clips);
  const analyzing = useStudio((s) => s.analyzing);
  const showToast = useStudio((s) => s.showToast);
  const exportState = useStudio((s) => s.exportState);
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);

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
    a.download = "ittyclip-project.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("Project saved");
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel/60 px-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-2" aria-label="ittyclip home">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand via-brand2 to-hot">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M5 3.5 L13 8 L5 12.5 Z" fill="white" />
          </svg>
        </span>
        <span className="font-display text-sm font-bold">
          itty<span className="text-gradient">clip</span>
        </span>
      </Link>

      <span className="h-5 w-px bg-line" aria-hidden />

      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-mute">
          {media ? media.name : "no project"}
        </p>
        {media && (
          <p className="text-[10px] text-mute/70">
            {fmtClock(media.duration)} · {clips.length} clip{clips.length === 1 ? "" : "s"} in timeline
            {analyzing && " · analyzing…"}
          </p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {session && (
          <span className="hidden max-w-[140px] truncate font-mono text-[10px] text-mute lg:inline">
            {session.name || session.email}
          </span>
        )}
        {media && (
          <>
            <button
              onClick={saveProject}
              className="rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-medium text-mute transition-colors hover:text-fg"
            >
              Save project
            </button>
            <button
              onClick={onExport}
              disabled={exportState === "running" || exportState === "loading"}
              className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportState === "running" ? "Exporting…" : "Export"}
            </button>
          </>
        )}
        <button
          onClick={signOut}
          className="rounded-full border border-hot/40 px-3 py-1.5 text-xs font-medium text-hot transition-colors hover:bg-hot/10"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
