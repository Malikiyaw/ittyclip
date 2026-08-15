import type { Metadata } from "next";
import { StudioShell } from "@/components/studio/StudioShell";
import { RequireAuth } from "@/components/studio/RequireAuth";

export const metadata: Metadata = {
  title: "Studio — ittyclip",
  description: "Drop a video. ittyclip hunts your best moments, captions them and exports vertical shorts — entirely in your browser.",
};

export default function StudioPage() {
  return (
    <RequireAuth>
      <StudioShell />
    </RequireAuth>
  );
}
