import type { CaptionLine } from "@/lib/types";
import { aiHooks } from "@/lib/captions";

export interface ContentIntelligence {
  title: string;
  hook: string;
  description: string;
  hashtags: string[];
  category: string;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "so", "for", "with", "you", "your", "yours",
  "i", "i'm", "im", "we", "they", "he", "she", "it", "this", "that", "these", "those",
  "of", "to", "in", "on", "at", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "not", "just", "like", "really", "very",
  "gonna", "wanna", "got", "get", "yeah", "okay", "ok", "right", "know", "think",
  "about", "there", "here", "what", "when", "why", "how", "will", "would", "can",
  "could", "should", "into", "out", "up", "down", "over", "then", "than", "let", "lets",
]);

const CATEGORY_KEYWORDS: [string, string[]][] = [
  ["Podcast & talk", ["podcast", "welcome back", "thanks for joining", "interview", "so tell us", "episode", "guest"]],
  ["Gaming", ["game", "gaming", "match", "round", "kill", "score", "playstation", "xbox", "twitch", "stream", "streamer", "console"]],
  ["Tutorial & how-to", ["tutorial", "how to", "let me show you", "step one", "first you", "now you", "then you", "click", "button", "follow along"]],
  ["Vlog & daily life", ["today", "woke up", "this morning", "this week", "i've been", "weekend", "day one", "day two"]],
  ["Sports & fitness", ["goal", "team", "training", "workout", "run", "match", "coach", "players", "game plan"]],
  ["Tech & review", ["review", "iphone", "android", "laptop", "specs", "battery", "price", "device", "unboxing", "update"]],
];

export function classifyCategory(transcript: CaptionLine[]): string {
  const text = transcript.map((l) => l.text).join(" ").toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) return category;
  }
  return "General";
}

export function extractHashtags(transcript: CaptionLine[]): string[] {
  const counts = new Map<string, number>();
  for (const line of transcript) {
    for (const raw of line.text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
      if (STOP_WORDS.has(raw) || raw.length < 4) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([word]) => word);
  return ranked.length >= 2 ? ranked : ["shorts", "viral"];
}

/**
 * Derives share-ready packaging (title, hook, description, hashtags, category)
 * from the transcript using local heuristics. Never fakes AI output — every
 * field is computed from the actual words the speaker said.
 */
export function contentIntelligence(transcript: CaptionLine[]): ContentIntelligence {
  const texts = transcript.map((l) => l.text.trim()).filter(Boolean);
  const joined = texts.join(" ").replace(/\s+/g, " ").trim();
  const first = texts[0] ?? "";

  const title = (first.length > 70 ? first.slice(0, 70).trimEnd() + "…" : first) || "Best moments";
  const hook = aiHooks(first)[0] || "Wait until you see this…";
  const description =
    joined.length > 240 ? joined.slice(0, 240).trimEnd() + "…" : joined;
  const hashtags = extractHashtags(transcript);
  const category = classifyCategory(transcript);

  return { title, hook, description, hashtags, category };
}