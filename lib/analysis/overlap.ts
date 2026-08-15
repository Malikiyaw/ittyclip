export interface TemporalSegment {
  start: number;
  end: number;
}

/** Overlap of two temporal segments, seconds. */
export function temporalOverlap(a: TemporalSegment, b: TemporalSegment): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** Union of two temporal segments, seconds. */
export function temporalUnion(a: TemporalSegment, b: TemporalSegment): number {
  return Math.max(a.end, b.end) - Math.min(a.start, b.start);
}

/** Intersection-over-union for temporal segments. */
export function temporalIoU(a: TemporalSegment, b: TemporalSegment): number {
  const union = temporalUnion(a, b);
  if (union <= 0) return 0;
  return temporalOverlap(a, b) / union;
}

/**
 * Non-maximum suppression over temporal segments.
 * Keeps the highest-priority items first and drops any item whose temporal
 * IoU with an already-kept item exceeds `threshold`.
 */
export function nonMaxSuppression<T extends TemporalSegment>(
  items: T[],
  threshold: number
): T[] {
  const kept: T[] = [];
  for (const item of items) {
    const overlaps = kept.some((k) => temporalIoU(item, k) > threshold);
    if (!overlaps) kept.push(item);
  }
  return kept;
}
