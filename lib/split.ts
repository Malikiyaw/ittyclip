"use client";

export interface SplitChar {
  el: HTMLElement;
  char: string;
}

export interface SplitWord {
  el: HTMLSpanElement;
  word: string;
  chars: SplitChar[];
}

export interface SplitResult {
  words: SplitWord[];
  chars: SplitChar[];
  container: HTMLElement;
}

/**
 * Splits the text content of an element into word/char spans wrapped in
 * overflow-hidden containers for staggered reveal animations.
 * Respects prefers-reduced-motion by returning the original text unsplit.
 */
export function splitText(
  el: HTMLElement,
  opts?: { preserveWhitespace?: boolean }
): SplitResult | null {
  if (!el) return null;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }

  const preserve = opts?.preserveWhitespace ?? true;
  const text = el.textContent || "";
  const container = el;
  container.textContent = "";
  container.setAttribute("aria-label", text.trim());

  const words: SplitWord[] = [];
  const chars: SplitChar[] = [];

  // Split into words (keeping whitespace)
  const segments = text.split(/(\s+)/).filter(Boolean);

  for (const segment of segments) {
    const isSpace = /^\s+$/.test(segment);

    if (isSpace) {
      if (preserve) {
        container.appendChild(document.createTextNode(segment));
      }
      continue;
    }

    // Create word wrapper with overflow hidden
    const wordWrap = document.createElement("span");
    wordWrap.className = "inline-block overflow-hidden align-bottom";
    wordWrap.style.perspective = "600px";

    const wordInner = document.createElement("span");
    wordInner.className = "inline-block whitespace-pre";
    wordInner.setAttribute("aria-hidden", "true");

    const wordChars: SplitChar[] = [];
    for (const ch of segment) {
      const charSpan = document.createElement("span");
      charSpan.className = "split-char inline-block";
      charSpan.textContent = ch;
      wordInner.appendChild(charSpan);
      wordChars.push({ el: charSpan, char: ch });
    }

    wordWrap.appendChild(wordInner);
    container.appendChild(wordWrap);

    const word: SplitWord = {
      el: wordWrap,
      word: segment,
      chars: wordChars,
    };
    words.push(word);
    chars.push(...wordChars);

    // Add space after word inside the overflow wrapper so it doesn't collapse
    if (preserve) {
      wordInner.appendChild(document.createTextNode("\u00A0"));
    }
  }

  return { words, chars, container };
}
