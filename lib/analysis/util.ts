export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const mean = (xs: number[]) => (xs.length === 0 ? 0 : sum(xs) / xs.length);
