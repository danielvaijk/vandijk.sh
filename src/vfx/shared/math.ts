function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number): number {
  const amount = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);

  return amount * amount * (3 - 2 * amount);
}

export { clamp, lerp, smoothstep };
