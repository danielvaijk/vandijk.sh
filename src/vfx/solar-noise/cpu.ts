import { clamp, lerp, smoothstep } from "src/vfx/shared/math";

const DIAGONAL_GRADIENT = Math.SQRT1_2;
const FRACTAL_NOISE_RANGE = 0.52 + 0.26 + 0.13 + 0.065;
const NOISE_VISUAL_WHITE_POINT = 0.63;

const fade = (value: number): number => value * value * value * (value * (value * 6 - 15) + 10);

const hash = (x: number, y: number, seed: number): number => {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);

  return (value ^ (value >>> 16)) >>> 0;
};

const gradient = (x: number, y: number, seed: number, dx: number, dy: number): number => {
  switch (hash(x, y, seed) & 7) {
    case 0:
      return dx;
    case 1:
      return -dx;
    case 2:
      return dy;
    case 3:
      return -dy;
    case 4:
      return (dx + dy) * DIAGONAL_GRADIENT;
    case 5:
      return (dx - dy) * DIAGONAL_GRADIENT;
    case 6:
      return (-dx + dy) * DIAGONAL_GRADIENT;
    default:
      return (-dx - dy) * DIAGONAL_GRADIENT;
  }
};

const perlin = (x: number, y: number, seed: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  const sx = fade(dx);
  const sy = fade(dy);
  const top = lerp(gradient(x0, y0, seed, dx, dy), gradient(x0 + 1, y0, seed, dx - 1, dy), sx);
  const bottom = lerp(
    gradient(x0, y0 + 1, seed, dx, dy - 1),
    gradient(x0 + 1, y0 + 1, seed, dx - 1, dy - 1),
    sx,
  );

  return lerp(top, bottom, sy);
};

const fractalNoise = (x: number, y: number, seed: number): number => {
  const total =
    perlin(x, y, seed) * 0.52 +
    perlin(x * 2, y * 2, seed + 101) * 0.26 +
    perlin(x * 4, y * 4, seed + 202) * 0.13 +
    perlin(x * 8, y * 8, seed + 303) * 0.065;

  return total / FRACTAL_NOISE_RANGE;
};

export const solarSurfaceBrightness = (
  col: number,
  row: number,
  time: number,
  seed: number,
): number => {
  const seconds = time / 1000;
  const x = col * 0.075;
  const y = row * 0.075;
  const convection = fractalNoise(
    x * 0.55 + seconds * 0.035,
    y * 0.55 - seconds * 0.025,
    seed + 211,
  );
  const shear = fractalNoise(x * 0.32 - seconds * 0.02, y * 0.32 + seconds * 0.03, seed + 353);
  const burstNoise = fractalNoise(
    x * 0.72 - seconds * 0.11 + convection * 0.35,
    y * 0.72 + seconds * 0.09 + shear * 0.35,
    seed + 1201,
  );
  const burst = smoothstep(0.48, 0.88, (burstNoise + 1) * 0.5);
  const displacement = convection * 2.4 + burst * 1.15;
  const arc = Math.sin((x - y) * 1.65 + seconds * 0.62 + convection * 3.4) * (0.28 + burst * 0.95);
  const twistX = Math.sin(y * 2.1 + seconds * 0.86 + shear * 4.2) * burst * 1.05;
  const twistY = Math.cos(x * 1.9 - seconds * 0.74 + convection * 4.0) * burst * 0.92;
  const flowX =
    x + displacement + arc + twistX + Math.sin(y * 1.3 + seconds * 0.45 + shear * 2.4) * 0.45;
  const flowY =
    y +
    shear * 1.85 -
    arc * 0.72 +
    twistY +
    Math.cos(x * 1.1 - seconds * 0.38 + convection * 2.1) * 0.42;
  const plumeNoise = fractalNoise(
    flowX * 0.95 - seconds * 0.24,
    flowY * 0.95 + seconds * 0.18,
    seed + 401,
  );
  const filamentNoise = fractalNoise(
    flowX * 2.6 + plumeNoise * 1.4 - seconds * 0.5,
    flowY * 1.8 - convection * 1.2 + seconds * 0.28,
    seed + 809,
  );
  const cells = smoothstep(0.34, 0.78, (plumeNoise + 1) * 0.5);
  const filaments = smoothstep(0.5, 0.9, (filamentNoise + 1) * 0.5);
  const pulse =
    0.5 + Math.sin(seconds * 0.7 + convection * 3.2 + shear * 2.4) * 0.06 + burst * 0.12;
  const softCells = smoothstep(0.16, 0.82, (plumeNoise + 1) * 0.5);
  const coreCells = cells * cells;
  const depth = softCells * 0.28 + coreCells * 0.42 + filaments * 0.24 + burst * 0.18;

  return clamp(0.12 + (depth + (convection + 1) * 0.07) * pulse, 0, 1);
};

export const noiseVisualBrightness = (brightness: number, visualRange: number): number =>
  clamp((brightness / NOISE_VISUAL_WHITE_POINT) * visualRange, 0, 1);
