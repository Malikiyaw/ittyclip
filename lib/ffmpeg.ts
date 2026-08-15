import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { CaptionLine, CaptionSettings, ExportJob } from "@/lib/types";
import { escapeDrawtext } from "@/lib/captions";
import { buildCropExpression } from "@/lib/reframe/trajectory";

const BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

export function supportsBrowserEncoding(): boolean {
  return typeof WebAssembly !== "undefined";
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading;
  loading = (async () => {
    if (!supportsBrowserEncoding()) throw new Error("This browser does not support in-browser video encoding.");
    const instance = new FFmpeg();
    await instance.load({
      coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpeg = instance;
    return instance;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

function escapeDrawtextAlpha(text: string): string { return escapeDrawtext(text).replace(/'/g, "\u2019"); }

const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  font: "display", size: 1, weight: "bold", textColor: "#FFFFFF", highlightColor: "#F7C948",
  position: "bottom", maxWidth: 0.86, stroke: false, shadow: true, background: "none",
  backgroundOpacity: 0.55, lineSpacing: 1.25, animation: "word-pop", uppercase: false,
};

function buildDrawtext(lines: CaptionLine[], segmentOffsets: number[], res: number, aspect: number, settings: CaptionSettings): string[] {
  const filters: string[] = [];
  const color = settings.textColor.replace("#", "0x");
  const yFrac = settings.position === "top" ? 0.12 : settings.position === "middle" ? 0.45 : 0.74;
  const y = Math.round(res * aspect * yFrac);
  for (const line of lines) for (let i = 0; i < segmentOffsets.length - 1; i++) {
    const segStart = segmentOffsets[i], segEnd = segmentOffsets[i + 1];
    const overlapStart = Math.max(line.start, segStart), overlapEnd = Math.min(line.end, segEnd);
    if (overlapEnd <= overlapStart) continue;
    const localStart = overlapStart - segStart, localEnd = overlapEnd - segStart;
    const fontsize = Math.round(res * 0.052 * settings.size), boxH = Math.round(fontsize * 0.55);
    const hasBox = settings.background !== "none", boxAlpha = hasBox ? settings.backgroundOpacity : 0;
    const text = settings.uppercase ? line.text.toUpperCase() : line.text;
    const border = settings.stroke ? `:borderw=${Math.max(1, Math.round(fontsize * 0.04))}:bordercolor=black@0.85` : "";
    const shadow = settings.shadow ? `:shadowx=0:shadowy=2:shadowcolor=black@0.85` : "";
    filters.push(`drawtext=fontfile=/font.ttf:text='${escapeDrawtextAlpha(text)}':fontsize=${fontsize}:fontcolor=${color}:box=${hasBox ? 1 : 0}:boxcolor=black@${boxAlpha.toFixed(2)}:boxborderw=${boxH}:x=(w-text_w)/2:y=${y}:enable='between(t,${localStart.toFixed(2)},${localEnd.toFixed(2)})'${border}${shadow}`);
  }
  return filters;
}

async function probeSourceDimensions(file: Blob): Promise<{ width: number; height: number }> {
  if (typeof document === "undefined") return { width: 1920, height: 1080 };
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const video = document.createElement("video");
      let settled = false;
      const finish = (width: number, height: number) => {
        if (settled) return;
        settled = true;
        resolve({ width: width || 1920, height: height || 1080 });
      };
      video.preload = "metadata";
      video.onloadedmetadata = () => finish(video.videoWidth, video.videoHeight);
      video.onerror = () => finish(1920, 1080);
      video.src = url;
      video.load();
      setTimeout(() => finish(video.videoWidth, video.videoHeight), 5000);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportVideo(file: Blob, job: ExportJob): Promise<{ blob: Blob; name: string }> {
  const instance = await getFFmpeg();
  job.onProgress(0.02);
  const progressHandler = ({ progress }: { progress: number }) =>
    job.onProgress(Math.min(0.97, 0.02 + (progress ?? 0) / 100));
  instance.on("progress", progressHandler);

  const source = await probeSourceDimensions(file);
  const vw = Math.max(2, Math.round(source.width));
  const vh = Math.max(2, Math.round(source.height));
  const aspect = job.aspect === "9:16" ? 9 / 16 : job.aspect === "1:1" ? 1 : job.aspect === "4:5" ? 4 / 5 : 16 / 9;
  const targetW = job.resolution;
  const targetH = Math.max(2, Math.round(job.resolution * aspect));
  const srcAspect = vw / vh;
  let cropW = vw;
  let cropH = vh;
  if (aspect < srcAspect) cropW = Math.max(2, Math.round(vh * aspect));
  else cropH = Math.max(2, Math.round(vw / aspect));

  const segments = job.segments
    .map((seg) => ({ start: Math.max(0, seg.start), end: Math.max(seg.start, seg.end) }))
    .filter((seg) => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end > seg.start);
  const safeSegments = segments.length > 0 ? segments : [{ start: 0, end: 0.5 }];

  try {
    await instance.writeFile("input.bin", await fetchFile(file));

    const parts: string[] = [];
    const offsets: number[] = [0];
    let acc = 0;
    safeSegments.forEach((seg, i) => {
      const d = Math.max(0.001, seg.end - seg.start);
      parts.push(
        `[0:v]trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`,
        `[0:a]atrim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
      );
      acc += d;
      offsets.push(acc);
    });
    const total = Math.max(0.5, acc);
    const concatIn = safeSegments.map((_, i) => `[v${i}][a${i}]`).join("");
    const concat = `${concatIn}concat=n=${safeSegments.length}:v=1:a=1[vc][ca]`;
    const chain: string[] = ["[vc]"];
    const reframeCrop = job.reframe ? buildCropExpression(job.reframe, aspect, vw, vh, total) : null;
    chain.push(reframeCrop || `crop=${cropW}:${cropH}:((iw-${cropW})/2):((ih-${cropH})/2)`);
    chain.push(`scale=${targetW}:${targetH}:flags=lanczos`);

    const captionSettings = job.captionSettings ?? DEFAULT_CAPTION_SETTINGS;
    let burnCaptions = job.burnCaptions;
    if (burnCaptions) {
      try {
        const fontData = await fetch("/fonts/ArchivoBlack-Regular.ttf").then((r) => {
          if (!r.ok) throw new Error("Font asset unavailable");
          return r.arrayBuffer();
        });
        await instance.writeFile("font.ttf", new Uint8Array(fontData));
      } catch {
        burnCaptions = false;
      }
    }
    if (burnCaptions) {
      for (const f of buildDrawtext(job.captions, offsets, job.resolution, aspect, captionSettings)) chain.push(f);
    }
    if (job.watermark) {
      const ws = Math.max(20, Math.round(job.resolution * 0.03));
      chain.push(`drawtext=fontfile=/font.ttf:text='ittyclip':fontsize=${ws}:fontcolor=white@0.35:x=w-text_w-24:y=24`);
    }

    const filterComplex = [...parts, concat, `${chain.join(",")},format=yuv420p[vout]`].join(";");
    const args = job.format === "mp4"
      ? ["-i", "input.bin", "-filter_complex", filterComplex, "-map", "[vout]", "-map", "[ca]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", total.toFixed(3), "-y", "out.mp4"]
      : ["-i", "input.bin", "-filter_complex", filterComplex, "-map", "[vout]", "-map", "[ca]", "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-c:a", "libopus", "-b:a", "96k", "-t", total.toFixed(3), "-y", "out.webm"];

    const logTail: string[] = [];
    const onLog = ({ message }: { message: string }) => {
      logTail.push(message);
      if (logTail.length > 60) logTail.shift();
    };
    instance.on("log", onLog);
    try {
      await instance.exec(args);
    } catch (err) {
      throw new Error(`Export failed: ${err instanceof Error ? err.message : String(err)}\n${logTail.slice(-12).join("\n")}`);
    } finally {
      instance.off("log", onLog);
    }

    const outputName = job.format === "mp4" ? "out.mp4" : "out.webm";
    const data = await instance.readFile(outputName);
    if (typeof data === "string") throw new Error("FFmpeg returned text instead of a binary output file.");
    const outputBuffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(outputBuffer).set(data);
    const blob = new Blob([outputBuffer], { type: job.format === "mp4" ? "video/mp4" : "video/webm" });
    job.onProgress(1);
    const safeName = (job.clipName || "ittyclip-export").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "ittyclip-export";
    return { blob, name: `${safeName}.${job.format}` };
  } finally {
    instance.off("progress", progressHandler);
    try { await instance.deleteFile("input.bin"); } catch {}
    try { await instance.deleteFile("out.mp4"); } catch {}
    try { await instance.deleteFile("out.webm"); } catch {}
    try { await instance.deleteFile("font.ttf"); } catch {}
  }
}