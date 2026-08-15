/**
 * Balanced 1–2 line caption breaking: punctuation-aware, keeps word groups
 * (like "the one thing") together, and prefers a ~2:3 or 3:2 character split
 * when a single line is too long.
 */

const KEEP_PAIRS = new Set([
  "the one thing", "you need to know", "i figured out", "took me", "this changed",
  "game changer", "nobody talks", "i have", "you have", "in the", "of the",
  "it was", "it is", "and then", "but the", "i'm going", "i want", "you can",
]);

const BREAK_AFTER = new Set([
  "and", "but", "so", "or", "because", "if", "then", "well", "okay", "now",
  "look", "listen", "remember", "actually", "basically", "honestly", "wait",
]);

function minCharCount(text: string): number {
  const m = text.match(/[a-z0-9]/gi);
  return m ? m.length : 0;
}

/**
 * Splits a caption into balanced lines. Returns a single-element array when
 * the text fits the `maxChars` budget; otherwise the best 2-way split is
 * found by punctuation first, then by a word boundary closest to the middle.
 */
export function breakCaptionLines(text: string, maxChars = 42): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  if (minCharCount(clean) <= maxChars) return [clean];

  const words = clean.split(" ");
  let bestSplit = -1;
  let bestScore = Infinity;

  const trySplit = (i: number, reason: number) => {
    const left = words.slice(0, i).join(" ");
    const right = words.slice(i).join(" ");
    if (!left || !right) return;
    const diff = Math.abs(minCharCount(left) - minCharCount(right));
    const penalty = diff + reason * 4;
    if (penalty < bestScore) {
      bestScore = penalty;
      bestSplit = i;
    }
  };

  // 1) Prefer breaking after punctuation words (and, but, so, now…).
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1].replace(/[^a-z'’]/gi, "").toLowerCase();
    if (BREAK_AFTER.has(prev)) {
      trySplit(i, 0);
      break;
    }
  }

  // 2) Prefer breaking before a KEEP_PAIRS bigram so it stays together.
  if (bestSplit === -1) {
    for (let i = 1; i < words.length - 1; i++) {
      const pair = `${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`;
      if (KEEP_PAIRS.has(pair)) {
        trySplit(i, 1);
        break;
      }
    }
  }

  // 3) Fallback: closest-to-middle word boundary.
  if (bestSplit === -1) {
    const half = minCharCount(clean) / 2;
    let best = -1;
    let bestDiff = Infinity;
    let acc = 0;
    for (let i = 1; i < words.length; i++) {
      acc += minCharCount(words[i - 1]);
      const d = Math.abs(acc - half);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    if (best > 0) {
      trySplit(best, 2);
    }
  }

  if (bestSplit <= 0) return [clean];
  const left = words.slice(0, bestSplit).join(" ");
  const right = words.slice(bestSplit).join(" ");
  return right ? [left, right] : [clean];
}
