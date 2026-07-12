import { clamp, lerp, smoothstep } from "src/vfx/shared/math";

const DIAGONAL_GRADIENT = Math.SQRT1_2;
const FRACTAL_NOISE_RANGE = 0.52 + 0.26 + 0.13 + 0.065;
const NOISE_VISUAL_WHITE_POINT = 0.63;

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function hash(x: number, y: number, seed: number): number {
  let value =
    Math.imul(x, 374_761_393) + Math.imul(y, 668_265_263) + Math.imul(seed, 2_246_822_519);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);

  return Math.trunc(value ^ (value >>> 16));
}

function gradient({
  coordinateX,
  coordinateY,
  seed,
  deltaX,
  deltaY,
}: {
  coordinateX: number;
  coordinateY: number;
  seed: number;
  deltaX: number;
  deltaY: number;
}): number {
  switch (hash(coordinateX, coordinateY, seed) & 7) {
    case 0: {
      return deltaX;
    }
    case 1: {
      return -deltaX;
    }
    case 2: {
      return deltaY;
    }
    case 3: {
      return -deltaY;
    }
    case 4: {
      return (deltaX + deltaY) * DIAGONAL_GRADIENT;
    }
    case 5: {
      return (deltaX - deltaY) * DIAGONAL_GRADIENT;
    }
    case 6: {
      return (-deltaX + deltaY) * DIAGONAL_GRADIENT;
    }
    default: {
      return (-deltaX - deltaY) * DIAGONAL_GRADIENT;
    }
  }
}

function perlin(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  const sx = fade(dx);
  const sy = fade(dy);
  const top = lerp(
    gradient({ coordinateX: x0, coordinateY: y0, deltaX: dx, deltaY: dy, seed }),
    gradient({ coordinateX: x0 + 1, coordinateY: y0, deltaX: dx - 1, deltaY: dy, seed }),
    sx,
  );
  const bottom = lerp(
    gradient({ coordinateX: x0, coordinateY: y0 + 1, deltaX: dx, deltaY: dy - 1, seed }),
    gradient({
      coordinateX: x0 + 1,
      coordinateY: y0 + 1,
      deltaX: dx - 1,
      deltaY: dy - 1,
      seed,
    }),
    sx,
  );

  return lerp(top, bottom, sy);
}

function fractalNoise(x: number, y: number, seed: number): number {
  const total =
    perlin(x, y, seed) * 0.52 +
    perlin(x * 2, y * 2, seed + 101) * 0.26 +
    perlin(x * 4, y * 4, seed + 202) * 0.13 +
    perlin(x * 8, y * 8, seed + 303) * 0.065;

  return total / FRACTAL_NOISE_RANGE;
}

function solarSurfaceBrightness({
  columnIndex,
  rowIndex,
  time,
  noiseSeed,
}: {
  columnIndex: number;
  rowIndex: number;
  time: number;
  noiseSeed: number;
}): number {
  const seconds = time / 1000;
  const pointX = columnIndex * 0.075;
  const pointY = rowIndex * 0.075;
  const convection = fractalNoise(
    pointX * 0.55 + seconds * 0.035,
    pointY * 0.55 - seconds * 0.025,
    noiseSeed + 211,
  );
  const shear = fractalNoise(
    pointX * 0.32 - seconds * 0.02,
    pointY * 0.32 + seconds * 0.03,
    noiseSeed + 353,
  );
  const burstNoise = fractalNoise(
    pointX * 0.72 - seconds * 0.11 + convection * 0.35,
    pointY * 0.72 + seconds * 0.09 + shear * 0.35,
    noiseSeed + 1201,
  );
  const burst = smoothstep(0.48, 0.88, (burstNoise + 1) * 0.5);
  const displacement = convection * 2.4 + burst * 1.15;
  const arc =
    Math.sin((pointX - pointY) * 1.65 + seconds * 0.62 + convection * 3.4) *
    (0.28 + burst * 0.95);
  const twistX = Math.sin(pointY * 2.1 + seconds * 0.86 + shear * 4.2) * burst * 1.05;
  const twistY = Math.cos(pointX * 1.9 - seconds * 0.74 + convection * 4) * burst * 0.92;
  const flowX =
    pointX +
    displacement +
    arc +
    twistX +
    Math.sin(pointY * 1.3 + seconds * 0.45 + shear * 2.4) * 0.45;
  const flowY =
    pointY +
    shear * 1.85 -
    arc * 0.72 +
    twistY +
    Math.cos(pointX * 1.1 - seconds * 0.38 + convection * 2.1) * 0.42;
  const plumeNoise = fractalNoise(
    flowX * 0.95 - seconds * 0.24,
    flowY * 0.95 + seconds * 0.18,
    noiseSeed + 401,
  );
  const filamentNoise = fractalNoise(
    flowX * 2.6 + plumeNoise * 1.4 - seconds * 0.5,
    flowY * 1.8 - convection * 1.2 + seconds * 0.28,
    noiseSeed + 809,
  );
  const cells = smoothstep(0.34, 0.78, (plumeNoise + 1) * 0.5);
  const filaments = smoothstep(0.5, 0.9, (filamentNoise + 1) * 0.5);
  const pulse =
    0.5 + Math.sin(seconds * 0.7 + convection * 3.2 + shear * 2.4) * 0.06 + burst * 0.12;
  const softCells = smoothstep(0.16, 0.82, (plumeNoise + 1) * 0.5);
  const coreCells = cells * cells;
  const depth = softCells * 0.28 + coreCells * 0.42 + filaments * 0.24 + burst * 0.18;

  return clamp(0.12 + (depth + (convection + 1) * 0.07) * pulse, 0, 1);
}

function noiseVisualBrightness(brightness: number, visualRange: number): number {
  return clamp((brightness / NOISE_VISUAL_WHITE_POINT) * visualRange, 0, 1);
}

export { noiseVisualBrightness, solarSurfaceBrightness };
