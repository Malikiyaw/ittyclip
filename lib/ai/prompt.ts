import type { ClipLength } from "@/lib/types";

export interface AiPromptSignals {
  duration: number;
  silence: { start: number; end: number }[];
  speech: { start: number; end: number }[];
  energy: { time: number; value: number }[];
}

export interface AiTranscriptLine {
  start: number;
  end: number;
  text: string;
}

export const fmtSec = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

/**
 * Builds the strict-JSON prompt for the highlight-selection model.
 * Shared by the API route (server) and tests (node).
 */
export function buildPrompt(input: {
  transcript: AiTranscriptLine[];
  signals: AiPromptSignals;
  clipLength: ClipLength;
  count: number;
}): { system: string; user: string } {
  const { transcript, signals, clipLength, count } = input;

  const transcriptBlock =
    transcript.length === 0
      ? "(no transcript available)"
      : transcript
          .map((l) => `[${fmtSec(l.start)} - ${fmtSec(l.end)}] ${l.text}`)
          .join("\n");

  const energyBlock = signals.energy
    .map((p) => `@${fmtSec(p.time)} ${p.value.toFixed(2)}`)
    .join(", ");

  const silenceBlock = signals.silence
    .slice(0, 120)
    .map((s) => `[${fmtSec(s.start)} - ${fmtSec(s.end)}]`)
    .join(", ");

  const system = `You are an elite short-form video editor with deep knowledge of what makes clips work on TikTok, Instagram Reels, and YouTube Shorts.
You receive a word-timed transcript of a long video plus audio signal summaries, and you must choose the ${count} best ${clipLength}-second segments to publish as standalone short-form clips.

Requirements:
1. Prefer moments with strong hooks, surprising reveals, specific numbers, clear questions, emotional statements, or standalone insight.
2. A clip must start and end at natural speech boundaries — never cut mid-word or mid-sentence.
3. Respect the target length: between ${Math.round(clipLength * 0.88)} and ${Math.round(clipLength * 1.12)} seconds where the content allows, but slightly shorter is better than slightly longer.
4. Do not pick overlapping moments — each clip must cover different content.
5. Score each clip 0-100 based on expected engagement (hook strength, pacing, emotional impact).
6. Give each clip a short punchy title (max 6 words) suitable as a social caption.
7. Choose the single most likely reason category for each clip from this exact list: energy, question, statement, quote, surprise, insight, pacing, hook, story, general.
8. Answer with valid JSON only — no markdown, no commentary.

JSON schema:
{
  "highlights": [
    {
      "start": <seconds, number>,
      "end": <seconds, number>,
      "score": <0-100, integer>,
      "title": "<string, max 6 words>",
      "reasonKey": "<one of: energy, question, statement, quote, surprise, insight, pacing, hook, story, general>",
      "reason": "<one short sentence explaining why this moment works>"
    }
  ]
}`;

  const user = `VIDEO METADATA
- Duration: ${fmtSec(signals.duration)} (${signals.duration.toFixed(1)}s)
- Target clip length: ${clipLength}s
- Clips to return: ${count}

TRANSCRIPT (word-timed, seconds since start)
${transcriptBlock}

AUDIO SIGNALS
- Silence segments (no speech): ${silenceBlock || "none"}
- Speech segments: ${
    signals.speech
      .slice(0, 80)
      .map((s) => `[${fmtSec(s.start)} - ${fmtSec(s.end)}]`)
      .join(", ") || "none"
  }
- Energy peaks (relative loudness 0-1): ${energyBlock || "none"}

Return the JSON now.`;

  return { system, user };
}
