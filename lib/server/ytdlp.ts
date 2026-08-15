import { execFile } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import { chmod } from "node:fs/promises";
import path from "node:path";

const BIN_DIR = path.join(process.cwd(), ".cache", "yt-dlp");
const RESOLVE_TIMEOUT_MS = 60_000;

const ASSETS: Record<string, string> = {
  "win32-x64": "yt-dlp.exe",
  "darwin-arm64": "yt-dlp_macos_aarch64",
  "darwin-x64": "yt-dlp_macos",
  "linux-arm64": "yt-dlp_linux_aarch64",
  "linux-x64": "yt-dlp_linux",
};

export function ytdlpBinPath(): string {
  const asset = ASSETS[`${process.platform}-${process.arch}`] ?? "yt-dlp";
  return path.join(BIN_DIR, asset);
}

let binaryPromise: Promise<string> | null = null;

async function downloadBinary(): Promise<string> {
  const binPath = ytdlpBinPath();
  if (existsSync(binPath)) return binPath;
  if (binaryPromise) return binaryPromise;
  binaryPromise = (async () => {
    const asset = path.basename(binPath);
    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
    mkdirSync(BIN_DIR, { recursive: true });
    const tmpPath = `${binPath}.part`;
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "ittyclip-import/1.0" },
    });
    if (!res.ok || !res.body) throw new Error("Couldn't download the yt-dlp binary.");
    const out = createWriteStream(tmpPath);
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        await new Promise<void>((resolve, reject) =>
          out.write(value, (err: Error | null | undefined) => (err ? reject(err) : resolve()))
        );
      }
      await new Promise<void>((resolve, reject) =>
          out.end((err: Error | null | undefined) => (err ? reject(err) : resolve()))
        );
    } catch (err) {
      out.destroy();
      throw err;
    }
    if (process.platform !== "win32") await chmod(tmpPath, 0o755);
    renameSync(tmpPath, binPath);
    return binPath;
  })();
  try {
    return await binaryPromise;
  } catch (err) {
    binaryPromise = null;
    throw err;
  }
}

function runExec(
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { ...options, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        const e = err as Error & { stderr?: string; killed?: boolean };
        reject(Object.assign(e, { stderr: stderr ?? e.stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export interface ResolvedMedia {
  url: string;
  title: string | null;
  ext: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
}

export async function resolvePlatformUrl(inputUrl: string): Promise<ResolvedMedia> {
  const binPath = await downloadBinary();
  const args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--no-call-home",
    "--no-progress",
    "--socket-timeout",
    "20",
    "--retries",
    "1",
    "-f",
    "b[ext=mp4]/b",
  ];
  const cookies = process.env.YTDLP_COOKIES?.trim();
  if (cookies) args.push("--cookies", cookies);
  args.push(inputUrl);

  let stdout: string;
  let stderr = "";
  try {
    const res = await runExec(binPath, args, {
      timeout: RESOLVE_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
    stdout = res.stdout;
    stderr = res.stderr || "";
  } catch (err) {
    const e = err as { stderr?: string; message?: string; killed?: boolean };
    stderr = e.stderr ?? "";
    if (e.killed) throw new Error("That platform link took too long to resolve.");
    throw new Error(friendlyResolutionError(stderr || e.message || ""));
  }

  try {
    const info = JSON.parse(stdout) as {
      url?: string;
      title?: string;
      ext?: string;
      duration?: number;
      width?: number;
      height?: number;
    };
    if (!info.url) throw new Error("No download URL found.");
    return {
      url: info.url,
      title: info.title ?? null,
      ext: info.ext ?? null,
      duration: info.duration ?? null,
      width: info.width ?? null,
      height: info.height ?? null,
    };
  } catch {
    throw new Error("Couldn't read the platform's video info.");
  }
}

function friendlyResolutionError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("unexpected response") && s.includes("tiktok")) {
    return "TikTok is blocking automated downloads right now. Try again later, or add your browser cookies via the YTDLP_COOKIES setting.";
  }
  if (s.includes("login") || s.includes("must sign in") || s.includes("sign in to")) {
    return "This platform requires a login to download. Add your browser cookies via the YTDLP_COOKIES setting.";
  }
  if (s.includes("not a bot") || s.includes("sign in to confirm")) {
    return "YouTube is asking to confirm you're not a bot — this video can't be downloaded without login.";
  }
  if (s.includes("private video") || s.includes("this video is private")) {
    return "That video is private and can't be imported.";
  }
  if (s.includes("age-restricted") || s.includes("sign in to view this video")) {
    return "That video is age-restricted and needs a signed-in account.";
  }
  if (s.includes("video unavailable") || s.includes("is unavailable") || s.includes("not available")) {
    return "That video is unavailable — it may be deleted, region-locked, or restricted.";
  }
  if (s.includes("live stream")) {
    return "Live streams can't be imported until they've ended.";
  }
  return "Couldn't download that platform video — it may be private, region-locked, or restricted.";
}