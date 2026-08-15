import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { classifyLink } from "@/lib/linkDetect";
import { resolvePlatformUrl } from "@/lib/server/ytdlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const HEADER_TIMEOUT_MS = 30_000;
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v|m4a|avi|ogv)$/i;
const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
const BLOCKED_HOST = /^(localhost|::1|fe80:|fc|fd)/i;

function isBlockedHost(host: string): string | null {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || BLOCKED_HOST.test(h)) {
    return h;
  }
  return PRIVATE_IP.test(h) ? h : null;
}

async function blockedAddress(host: string): Promise<string | null> {
  const direct = isBlockedHost(host);
  if (direct) return direct;
  try {
    const { address } = await lookup(host, { verbatim: true });
    if (PRIVATE_IP.test(address) || BLOCKED_HOST.test(address)) return address;
  } catch {
    return null;
  }
  return null;
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "Missing ?url= parameter." }, { status: 400 });

  let upstreamUrl: URL;
  let expectedExt: string | null = null;
  let resolvedTitle: string | null = null;

  if (classifyLink(rawUrl) === "platform") {
    let resolved;
    try {
      resolved = await resolvePlatformUrl(rawUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resolve that platform link.";
      return NextResponse.json({ error: message }, { status: 422 });
    }
    upstreamUrl = new URL(resolved.url);
    expectedExt = resolved.ext;
    resolvedTitle = resolved.title;
  } else {
    try {
      upstreamUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
    }
  }
  if (upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) links are supported." }, { status: 400 });
  }

  const blocked = await blockedAddress(upstreamUrl.hostname);
  if (blocked) {
    return NextResponse.json(
      { error: "This link points to a local/private address and was blocked for safety." },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(upstreamUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "video/*,*/*;q=0.8",
        "User-Agent": "ittyclip-import/1.0",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach that link — it may be down or blocked." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => undefined);
    return NextResponse.json({ error: `The link responded with ${res.status}.` }, { status: 502 });
  }

  const contentType = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const isVideo =
    contentType.startsWith("video/") ||
    (contentType === "application/octet-stream" &&
      (expectedExt ? VIDEO_EXT.test("." + expectedExt) : VIDEO_EXT.test(upstreamUrl.pathname)));
  if (!isVideo) {
    await res.body.cancel().catch(() => undefined);
    return NextResponse.json(
      { error: "That link doesn't point to a video file (got " + (contentType || "unknown content") + ")." },
      { status: 415 }
    );
  }

  const declared = Number(res.headers.get("content-length") ?? NaN);
  if (!Number.isNaN(declared) && declared > MAX_BYTES) {
    await res.body.cancel().catch(() => undefined);
    return NextResponse.json({ error: "That video is larger than the 2 GB limit." }, { status: 413 });
  }

  let total = 0;
  const reader = res.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          streamController.close();
          return;
        }
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel().catch(() => undefined);
          streamController.error(new Error("too large"));
          return;
        }
        streamController.enqueue(value);
      } catch (err) {
        streamController.error(err);
      }
    },
    cancel() {
      return reader.cancel().catch(() => undefined);
    },
  });

  let dispName: string;
  if (resolvedTitle) {
    dispName = safeName(resolvedTitle);
    if (!/\.[a-z0-9]{2,5}$/i.test(dispName)) dispName += "." + (expectedExt || "mp4");
  } else {
    dispName =
      safeName(decodeURIComponent(upstreamUrl.pathname.split("/").pop() || "")) || "video-imported.mp4";
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType || "video/mp4");
  headers.set("Content-Disposition", `attachment; filename="${dispName}"`);
  if (!Number.isNaN(declared)) headers.set("Content-Length", String(declared));
  headers.set("Cache-Control", "no-store");

  return new NextResponse(stream, { status: 200, headers });
}