import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { CaptionLine, ExportJob } from "@/lib/types";
import { escapeDrawtext } from "@/lib/captions";

const BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm";
let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

export function supportsBrowserEncoding(): boolean {
  return typeof SharedArrayBuffer !== "undefined" && typeof Worker !== "undefined";
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading;
  loading = (async () => {
    if (!supportsBrowserEncoding()) {
      throw new Error("This browser lacks SharedArrayBuffer support. Use Chrome or Edge for in-browser export.");
    }
    const instance = new FFmpeg();
    await instance.load({
      coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: await toBlobURL(`${BASE}/worker.js`, "text/javascript"),
    });
    ffmpeg = instance;
    return instance;
  })();
  return loading;
}

function escapeDrawtextAlpha(text: string): string {
  return escapeDrawtext(text).replace(/'/g, "\u2019");
}

function buildDrawtext(
  lines: CaptionLine[],
  segmentOffsets: number[],
  total: number,
  res: number,
  aspect: number
): string[] {
  const filters: string[] = [];
  for (const line of lines) {
    for (let i = 0; i < segmentOffsets.length - 1; i++) {
      const segStart = segmentOffsets[i];
      const segEnd = segmentOffsets[i + 1];
      const overlapStart = Math.max(line.start, segStart);
      const overlapEnd = Math.min(line.end, segEnd);
      if (overlapEnd <= overlapStart) continue;
      const localStart = overlapStart - segStart;
      const localEnd = overlapEnd - segStart;
      const fontsize = Math.round(res * 0.052);
      const boxH = Math.round(fontsize * 0.55);
      const y = Math.round(res * aspect * 0.74);
      filters.push(
        `drawtext=fontfile=/font.ttf:text='${escapeDrawtextAlpha(
          line.text
        )}':fontsize=${fontsize}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=${boxH}:x=(w-text_w)/2:y=${y}:enable='between(t,${localStart.toFixed(2)},${localEnd.toFixed(2)})'`
      );
    }
  }
  if (filters.length === 0) return [];
  void total;
  return filters;
}

export async function exportVideo(file: Blob, job: ExportJob): Promise<{ blob: Blob; name: string }> {
  const instance = await getFFmpeg();
  job.onProgress(0.02);

  instance.on("progress", ({ progress }) => {
    job.onProgress(Math.min(0.97, 0.02 + (progress ?? 0) / 100));
  });

  await instance.writeFile("input.bin", await fetchFile(file));

  const aspect = job.aspect === "9:16" ? 9 / 16 : job.aspect === "1:1" ? 1 : job.aspect === "4:5" ? 4 / 5 : 16 / 9;
  const targetW = job.resolution;
  const targetH = Math.round(job.resolution * aspect);

  const vw = 1920;
  const vh = 1080;
  const srcAspect = vw / vh;

  let cropW = vw;
  let cropH = vh;
  if (aspect > srcAspect) {
    cropW = Math.round(vh * aspect);
  } else {
    cropH = Math.round(vw / aspect);
  }

  const parts: string[] = [];
  const offsets: number[] = [];
  let acc = 0;
  offsets.push(0);
  job.segments.forEach((seg, i) => {
    const d = seg.end - seg.start;
    parts.push(
      `[0:v]trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
    );
    acc += d;
    offsets.push(acc);
  });
  const total = Math.max(0.5, acc);

  const concatIn = job.segments.map((_, i) => `[v${i}][a${i}]`).join("");
  const concat = `${concatIn}concat=n=${job.segments.length}:v=1:a=1[vc][ca]`;

  const chain: string[] = ["[vc]"];
  chain.push(`crop=${cropW}:${cropH}:((iw-${cropW})/2):((ih-${cropH})/2)`);
  chain.push(`scale=${targetW}:${targetH}:flags=lanczos`);

  const captionFilters = job.burnCaptions
    ? buildDrawtext(job.captions, offsets, total, job.resolution, aspect)
    : [];
  for (const f of captionFilters) chain.push(f);

  if (job.watermark) {
    const ws = Math.max(20, Math.round(job.resolution * 0.03));
    chain.push(
      `drawtext=fontfile=/font.ttf:text='ittyclip':fontsize=${ws}:fontcolor=white@0.35:x=w-text_w-24:y=24`
    );
  }

  const videoChain = `${chain.join(",")},format=yuv420p[vout]`;

  const filterComplex = [...parts, concat, videoChain].join(";");

  const args =
    job.format === "mp4"
      ? [
          "-i",
          "input.bin",
          "-filter_complex",
          filterComplex,
          "-map",
          "[vout]",
          "-map",
          "[ca]",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          "-t",
          total.toFixed(3),
          "-y",
          "out.mp4",
        ]
      : [
          "-i",
          "input.bin",
          "-filter_complex",
          filterComplex,
          "-map",
          "[vout]",
          "-map",
          "[ca]",
          "-c:v",
          "libvpx-vp9",
          "-crf",
          "32",
          "-b:v",
          "0",
          "-c:a",
          "libopus",
          "-b:a",
          "96k",
          "-t",
          total.toFixed(3),
          "-y",
          "out.webm",
        ];

  try {
    const fontData = await fetch("/fonts/ArchivoBlack-Regular.ttf").then((r) => r.arrayBuffer());
    await instance.writeFile("font.ttf", new Uint8Array(fontData));
  } catch {
    job.burnCaptions = false;
  }

  const logTail: string[] = [];
  const onLog = ({ message }: { message: string }) => {
    logTail.push(message);
    if (logTail.length > 60) logTail.shift();
  };
  instance.on("log", onLog);

  try {
    await instance.exec(args);
  } catch (err) {
    const log = logTail.slice(-12).join("\n");
    throw new Error(`Export failed: ${err instanceof Error ? err.message : String(err)}\n${log}`);
  } finally {
    instance.off("log", onLog);
  }

  job.onProgress(0.985);
  const outName = job.format === "mp4" ? "out.mp4" : "out.webm";
  const data = await instance.readFile(outName);
  await instance.deleteFile("input.bin").catch(() => {});
  await instance.deleteFile("font.ttf").catch(() => {});
  await instance.deleteFile(outName).catch(() => {});

  job.onProgress(1);
  const raw = data as Uint8Array;
  const safe = new Uint8Array(raw.length);
  safe.set(raw);
  const blob = new Blob([safe], { type: job.format === "mp4" ? "video/mp4" : "video/webm" });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return { blob, name: `ittyclip-${stamp}.${job.format}` };
}
