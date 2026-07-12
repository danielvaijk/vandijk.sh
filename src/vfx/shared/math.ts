export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;

export const smoothstep = (edgeStart: number, edgeEnd: number, value: number): number => {
  const amount = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);

  return amount * amount * (3 - 2 * amount);
};
