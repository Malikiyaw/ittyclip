import { useStudio } from "@/store/studio";
import { basenameFromUrl } from "@/lib/linkDetect";
import { MAX_LOCAL_ANALYSIS_BYTES } from "@/lib/audio";

const MAX_IMPORT_BYTES = MAX_LOCAL_ANALYSIS_BYTES;

export type LinkImportErrorCode = "PLATFORM_BOT_CHECK" | "PLATFORM_RESOLVE_FAILED" | "INVALID_URL" | "NOT_VIDEO" | "TOO_LARGE" | "UPSTREAM_ERROR" | "UPSTREAM_UNREACHABLE" | "UNKNOWN";

export class LinkImportError extends Error {
  code: LinkImportErrorCode;
  status: number;
  constructor(message: string, code: LinkImportErrorCode = "UNKNOWN", status = 0) {
    super(message);
    this.name = "LinkImportError";
    this.code = code;
    this.status = status;
  }
}

export async function importFromLink(url: string, onProgress: (receivedMb: number) => void): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/fetch/video?url=${encodeURIComponent(url)}`);
  } catch {
    throw new LinkImportError("Import failed — check your connection and try again.", "UPSTREAM_UNREACHABLE");
  }

  if (!res.ok) {
    let message = `Import failed (${res.status})`;
    let code: LinkImportErrorCode = "UNKNOWN";
    try {
      const body = (await res.json()) as { error?: string; code?: LinkImportErrorCode };
      if (body.error) message = body.error;
      if (body.code) code = body.code;
    } catch { /* keep status message */ }
    throw new LinkImportError(message, code, res.status);
  }

  if (!res.body) throw new LinkImportError("Import failed — the link returned no data.", "UPSTREAM_ERROR", res.status);

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > MAX_IMPORT_BYTES) throw new LinkImportError(`This linked video is ${(contentLength / 1024 / 1024).toFixed(0)} MB. Link imports are limited to 120 MB to keep the browser stable.`, "TOO_LARGE", 413);

  const contentType = res.headers.get("content-type")?.split(";")[0].trim() || "video/mp4";
  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_IMPORT_BYTES) {
        try { await reader.cancel("video exceeds browser-safe import limit"); } catch {}
        throw new LinkImportError("This linked video is larger than 120 MB. The import was stopped before it could consume more memory.", "TOO_LARGE", 413);
      }
      parts.push(value);
      onProgress(received / (1024 * 1024));
    }
  } catch (err) {
    if (err instanceof LinkImportError) throw err;
    throw new LinkImportError("Import interrupted — the video may be too large or the connection dropped.", "UPSTREAM_ERROR");
  }

  const file = new File(parts, basenameFromUrl(url), { type: contentType });
  await useStudio.getState().ingest(file);
}