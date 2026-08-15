export type LinkKind = "direct" | "platform" | "unknown";

const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v|m4a|avi|ogv)(\?|#|$)/i;

const PLATFORM_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "vimeo.com",
  "twitch.tv",
  "dailymotion.com",
  "facebook.com",
  "fb.watch",
  "x.com",
  "twitter.com",
];

export function classifyLink(rawUrl: string): LinkKind {
  let host = "";
  let path = "";
  try {
    const u = new URL(rawUrl);
    host = u.hostname.toLowerCase();
    path = u.pathname;
  } catch {
    return "unknown";
  }
  const isPlatform = PLATFORM_HOSTS.some((p) => host === p || host.endsWith("." + p));
  if (isPlatform) return "platform";
  if (VIDEO_EXT.test(path)) return "direct";
  return "unknown";
}

export function basenameFromUrl(rawUrl: string): string {
  try {
    const path = decodeURIComponent(new URL(rawUrl).pathname.split("/").pop() || "");
    if (path && path.includes(".")) return path.replace(/[^\w.-]+/g, "_");
  } catch {
    /* fall through */
  }
  return "video-imported.mp4";
}