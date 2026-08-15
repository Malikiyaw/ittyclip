import { useStudio } from "@/store/studio";
import { basenameFromUrl } from "@/lib/linkDetect";
import { MAX_LOCAL_ANALYSIS_BYTES } from "@/lib/audio";

const MAX_IMPORT_BYTES = MAX_LOCAL_ANALYSIS_BYTES;

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

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > MAX_IMPORT_BYTES) {
    throw new Error(`This linked video is ${(contentLength / 1024 / 1024).toFixed(0)} MB. Link imports are limited to 120 MB to keep the browser stable.`);
  }

  const contentType = res.headers.get("content-type")?.split(";")[0].trim() || "video/mp4";
  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > MAX_IMPORT_BYTES) {
          try { await reader.cancel("video exceeds browser-safe import limit"); } catch {}
          throw new Error(`This linked video is larger than 120 MB. The import was stopped before it could consume more memory.`);
        }
        parts.push(value);
        onProgress(received / (1024 * 1024));
      }
    }
  } catch (err) {
    if (err instanceof Error && /120 MB|browser-safe/.test(err.message)) throw err;
    throw new Error("Import interrupted — the video may be too large or the connection dropped.");
  }

  const file = new File(parts, basenameFromUrl(url), { type: contentType });
  await useStudio.getState().ingest(file);
}
