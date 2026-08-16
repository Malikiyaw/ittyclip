const KEY_STORAGE = "ittyclip:ai:key";
const BASE_URL_STORAGE = "ittyclip:ai:baseUrl";

function read(name: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(name) ?? "";
  } catch {
    return "";
  }
}

function write(name: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(name, value);
    else window.localStorage.removeItem(name);
  } catch {
    // storage unavailable (private mode etc.) — fall back to server env key
  }
}

/** The user's own NVIDIA (or OpenAI-compatible) API key, stored on this device only. */
export function getAiKey(): string {
  return read(KEY_STORAGE).trim();
}

export function setAiKey(key: string) {
  write(KEY_STORAGE, key.trim());
}

export function clearAiKey() {
  write(KEY_STORAGE, "");
}

/** Optional OpenAI-compatible base URL override (advanced). */
export function getAiBaseUrl(): string {
  return read(BASE_URL_STORAGE).trim();
}

export function setAiBaseUrl(url: string) {
  write(BASE_URL_STORAGE, url.trim());
}

export function clearAiBaseUrl() {
  write(BASE_URL_STORAGE, "");
}

/**
 * Headers for AI API calls. The key is sent to this app's own server routes
 * (`/api/ai/*`), never to third parties directly.
 */
export function aiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = getAiKey();
  if (key) headers["x-ai-key"] = key;
  const baseUrl = getAiBaseUrl();
  if (baseUrl) headers["x-ai-base-url"] = baseUrl;
  return headers;
}

/** True when the browser holds a key OR the server is configured via env. */
export async function isAiReady(): Promise<boolean> {
  if (getAiKey()) return true;
  try {
    const res = await fetch("/api/ai/status", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: boolean };
    return Boolean(data.configured);
  } catch {
    return false;
  }
}
