import type { ClipLength, VisualEvent } from "@/lib/types";

export interface AiPromptSignals {
  duration: number;
  silence: { start: number; end: number }[];
  speech: { start: number; end: number }[];
  energy: { time: number; value: number }[];
  visualEvents?: VisualEvent[];
}
export interface AiTranscriptLine { start: number; end: number; text: string; }
export const fmtSec = (t: number) => { const m = Math.floor(t / 60); const s = t % 60; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };

export function buildPrompt(input: { transcript: AiTranscriptLine[]; signals: AiPromptSignals; clipLength: ClipLength; count: number }): { system: string; user: string } {
  const { transcript, signals, clipLength, count } = input;
  const transcriptBlock = transcript.length === 0 ? "(no transcript available)" : transcript.map((l) => `[${fmtSec(l.start)} - ${fmtSec(l.end)}] ${l.text}`).join("\n");
  const energyBlock = signals.energy.map((p) => `@${fmtSec(p.time)} ${p.value.toFixed(2)}`).join(", ");
  const silenceBlock = signals.silence.slice(0, 120).map((s) => `[${fmtSec(s.start)} - ${fmtSec(s.end)}]`).join(", ");
  const visualBlock = (signals.visualEvents ?? []).filter((e) => e.change >= 0.28 || e.face).slice(0, 100).map((e) => `@${fmtSec(e.time)} change=${e.change.toFixed(2)}${e.face ? " face" : ""}`).join(", ");

  const system = `You are an elite short-form video editor with deep knowledge of TikTok, Instagram Reels, and YouTube Shorts. You receive a word-timed transcript plus audio and lightweight visual event summaries. Choose the ${count} best ${clipLength}-second segments as standalone clips.

Requirements:
1. Prefer strong hooks, surprising reveals, specific numbers, clear questions, emotional statements, or standalone insight.
2. Use visual events as supporting evidence: scene changes and visible faces can increase engagement, but never override a weak story.
3. Start and end at natural speech boundaries — never cut mid-word or mid-sentence.
4. Respect the target length: between ${Math.round(clipLength * 0.88)} and ${Math.round(clipLength * 1.12)} seconds where content allows.
5. Do not pick overlapping moments; maximize topic and content diversity.
6. Score each clip 0-100 based on hook strength, pacing, emotional impact, standalone value, and visual support.
7. Give each clip a punchy title (max 6 words).
8. Choose one reasonKey from: energy, question, statement, quote, surprise, insight, pacing, hook, story, general.
9. Return valid JSON only — no markdown or commentary.

JSON schema:
{"highlights":[{"start":<seconds>,"end":<seconds>,"score":<0-100 integer>,"title":"<max 6 words>","reasonKey":"<allowed key>","reason":"<one short sentence>"}]}`;

  const user = `VIDEO METADATA
- Duration: ${fmtSec(signals.duration)} (${signals.duration.toFixed(1)}s)
- Target clip length: ${clipLength}s
- Clips to return: ${count}

TRANSCRIPT (word-timed)
${transcriptBlock}

AUDIO SIGNALS
- Silence segments: ${silenceBlock || "none"}
- Speech segments: ${signals.speech.slice(0, 80).map((s) => `[${fmtSec(s.start)} - ${fmtSec(s.end)}]`).join(", ") || "none"}
- Energy peaks: ${energyBlock || "none"}

VISUAL EVENTS
- High-change / face frames: ${visualBlock || "none"}

Return the JSON now.`;
  return { system, user };
}
