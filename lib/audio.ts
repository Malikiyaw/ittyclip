import type { AnalysisResult, Moment } from "@/lib/types";
import { uid } from "@/lib/types";

const HOP_MS = 50;

function decodeAudio(file: Blob): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    file.arrayBuffer().then((buf) => {
      ctx.decodeAudioData(
        buf,
        (audio) => {
          ctx.close().catch(() => {});
          resolve(audio);
        },
        (err) => reject(new Error("Could not decode audio track: " + err?.message))
      );
    });
  });
}

export function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
  return decodeAudio(file);
}

function computeEnvelope(buffer: AudioBuffer): Float32Array {
  const ch = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const hop = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));
  const total = Math.floor(buffer.length / hop);
  const env = new Float32Array(total);
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < total; i++) {
      const off = i * hop;
      const end = Math.min(off + hop, data.length);
      let sum = 0;
      for (let j = off; j < end; j += 8) {
        const v = data[j];
        sum += v * v;
      }
      env[i] += sum / Math.max(1, (end - off) / 8);
    }
  }
  for (let i = 0; i < total; i++) env[i] = Math.sqrt(env[i] / ch);
  return env;
}

function detectSilence(env: Float32Array, duration: number, hop: number) {
  const sorted = Array.from(env).sort((a, b) => b - a);
  const p95 = sorted[Math.floor(sorted.length * 0.05)];
  const floor = Math.max(0.0018, p95 * 0.14);
  const silence: { start: number; end: number }[] = [];
  let inSilence = false;
  let start = 0;
  for (let i = 0; i < env.length; i++) {
    const quiet = env[i] < floor;
    if (quiet && !inSilence) {
      inSilence = true;
      start = i * hop;
    } else if (!quiet && inSilence) {
      inSilence = false;
      const end = i * hop;
      if (end - start > 0.45) silence.push({ start, end });
    }
  }
  if (inSilence && env.length * hop - start > 0.45) {
    silence.push({ start, end: duration });
  }
  return silence;
}

function scoreWindow(env: Float32Array, a: number, b: number) {
  if (b <= a) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let max = 0;
  let min = Infinity;
  for (let i = a; i < b; i++) {
    const v = env[i];
    sum += v;
    sumSq += v * v;
    if (v > max) max = v;
    if (v < min) min = v;
    n++;
  }
  if (n === 0) return 0;
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const burst = max - min;
  const activity = max > 0.02 ? 1 : 0.25;
  return (variance * 3.2 + burst * 1.4 + mean * 0.8 + activity) * n;
}

export function detectMoments(
  env: Float32Array,
  duration: number,
  hop: number,
  maxClips = 6,
  minLen = 8,
  maxLen = 45
): Moment[] {
  const win = Math.round(20 / HOP_MS);
  const step = Math.round(4 / HOP_MS);
  const candidates: { start: number; end: number; score: number }[] = [];
  for (let a = 0; a + win <= env.length; a += step) {
    const score = scoreWindow(env, a, a + win);
    candidates.push({ start: a * hop, end: Math.min(duration, (a + win) * hop), score });
  }
  candidates.sort((x, y) => y.score - x.score);
  const picked: Moment[] = [];
  for (const c of candidates) {
    if (picked.length >= maxClips) break;
    const overlaps = picked.some((p) => c.start < p.end - 2 && p.start < c.end - 2);
    if (overlaps) continue;
    let { start, end } = c;
    if (end - start > maxLen) end = start + maxLen;
    if (end - start < minLen) end = Math.min(duration, start + minLen);
    if (start < 0.15) start = 0;
    picked.push({
      id: uid(),
      start: Math.max(0, start),
      end: Math.min(duration, end),
      score: Math.round(100 + (c.score / (candidates[0]?.score || 1)) * 900),
      label: `Highlight ${picked.length + 1}`,
    });
  }
  return picked.sort((a, b) => a.start - b.start);
}

export async function analyzeFile(file: File, onProgress?: (p: number) => void): Promise<AnalysisResult> {
  onProgress?.(0.05);
  const buffer = await decodeAudio(file);
  onProgress?.(0.3);
  const env = computeEnvelope(buffer);
  onProgress?.(0.55);
  const duration = buffer.duration;
  const silence = detectSilence(env, duration, HOP_MS);
  onProgress?.(0.75);
  const moments = detectMoments(env, duration, HOP_MS);
  onProgress?.(1);
  return { duration, envelope: env, moments, silence };
}

export function waveformPeaks(env: Float32Array, width: number): number[] {
  if (width <= 0 || env.length === 0) return [];
  const out = new Array<number>(width).fill(0);
  const per = env.length / width;
  for (let x = 0; x < width; x++) {
    const a = Math.floor(x * per);
    const b = Math.min(env.length, Math.ceil((x + 1) * per));
    let max = 0;
    for (let i = a; i < b; i += 2) {
      if (env[i] > max) max = env[i];
    }
    out[x] = max;
  }
  const top = Math.max(0.001, ...out);
  return out.map((v) => v / top);
}
