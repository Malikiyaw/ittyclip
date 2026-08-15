import { useStudio } from "@/store/studio";
import { basenameFromUrl } from "@/lib/linkDetect";

export async function importFromLink(
  url: string,
  onProgress: (receivedMb: number) => void
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/fetch/video?url=${encodeURIComponent(url)}`);
  } catch {
    throw new Error("Import failed — check your connection and try again.");
  }

  if (!res.ok) {
    let message = `Import failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep status message */
    }
    throw new Error(message);
  }

  if (!res.body) throw new Error("Import failed — the link returned no data.");

  const contentType = res.headers.get("content-type")?.split(";")[0].trim() || "video/mp4";
  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      received += value.byteLength;
      onProgress(received / (1024 * 1024));
    }
  } catch {
    throw new Error("Import interrupted — the video may be too large or the connection dropped.");
  }

  const file = new File(parts, basenameFromUrl(url), { type: contentType });
  await useStudio.getState().ingest(file);
}