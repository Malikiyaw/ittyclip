import type { CaptionLine, Word } from "@/lib/types";
import { uid } from "@/lib/types";

export { breakCaptionLines } from "@/lib/captions/breaking";
export {
  CAPTION_PRESETS,
  DEFAULT_CAPTION_SETTINGS,
  animationClass,
  presetFor,
  type CaptionPresetKey,
} from "@/lib/captions/presets";
export {
  CAPTION_SAFE_BOTTOM,
  CAPTION_SAFE_TOP,
  SAFE_ZONES,
  type SafeZoneKey,
} from "@/lib/captions/safezones";

export function segmentTranscript(
  text: string,
  segments: { start: number; end: number }[],
  targetWords = 8
): CaptionLine[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || segments.length === 0) return [];
  const active = segments;
  const totalTime = active.reduce((s, seg) => s + (seg.end - seg.start), 0);
  const perWord = totalTime / words.length;
  const lines: CaptionLine[] = [];
  let wi = 0;
  for (const seg of active) {
    const avail = seg.end - seg.start;
    const wordsFor = Math.max(1, Math.round(avail / perWord));
    if (wi >= words.length) break;
    const chunk = words.slice(wi, wi + wordsFor);
    wi += wordsFor;
    const lineWords: Word[] = [];
    let t = seg.start;
    const lineTotal = chunk.reduce((s, w) => s + w.length, 0) || 1;
    for (const w of chunk) {
      const dur = Math.max(0.12, (w.length / lineTotal) * avail);
      lineWords.push({ text: w, start: t, end: Math.min(seg.end, t + dur) });
      t += dur;
    }
    lines.push({
      id: uid(),
      start: seg.start,
      end: Math.min(seg.end, t),
      text: chunk.join(" "),
      words: lineWords,
    });
  }
  return lines;
}

export function makeLines(words: string[], duration: number): CaptionLine[] {
  const active = [{ start: 0, end: duration }];
  return segmentTranscript(words.join(" "), active, 9);
}

export function buildWords(text: string, start: number, end: number): Word[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const total = Math.max(0.1, end - start);
  const sum = words.reduce((acc, w) => acc + Math.max(1, w.length), 1);
  let t = start;
  return words.map((w) => {
    const dur = (Math.max(1, w.length) / sum) * total;
    const word = { text: w, start: t, end: t + dur };
    t += dur;
    return word;
  });
}

export function srtTimestamp(t: number) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function buildSrt(lines: CaptionLine[]): string {
  return lines
    .map((l, i) => `${i + 1}\n${srtTimestamp(l.start)} --> ${srtTimestamp(l.end)}\n${l.text}\n`)
    .join("\n");
}

// Backslash must be escaped FIRST — later rules introduce backslashes
// (e.g. "'" → "\'") that must not be re-escaped by the backslash rule.
const ESCAPE_RULES: [RegExp, string][] = [
  [/\\/g, "\\\\"],
  [/'/g, "\\'"],
  [/:/g, "\\:"],
  [/%/g, "\\%"],
  [/,/g, "\\,"],
  [/;/g, "\\;"],
  [/\{/g, "\\{"],
  [/\}/g, "\\}"],
  [/\[/g, "\\["],
  [/\]/g, "\\]"],
  [/\)/g, "\\)"],
  [/\|/g, "\\|"],
];

export function escapeDrawtext(text: string): string {
  let out = text;
  for (const [re, rep] of ESCAPE_RULES) out = out.replace(re, rep);
  return out.replace(/\n/g, " ");
}

export function aiHooks(text: string): string[] {
  const clean = text.replace(/[^\w\s'’-]/g, "").trim();
  const words = clean.split(/\s+/).slice(0, 10);
  if (words.length < 3) return ["This changed everything", "You have to see this"];
  const base = words.join(" ");
  const punc = /[!?.]$/.test(base) ? "" : "...";
  const hook = base.charAt(0).toUpperCase() + base.slice(1) + punc;
  return [hook, `POV: ${base}${punc}`, `Wait until ${base.slice(0, 42)}`];
}
