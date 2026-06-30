import type { QwikJSX } from "@builder.io/qwik";
import { component$, useId, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";

import styles from "src/components/glyph-raster.scss?inline";

type GlyphRasterVariant = "eye" | "noise";

export type GlyphRasterFit = "contain" | "cover";
export type GlyphRasterLayout = "fill" | "fixed";

export type GlyphRasterFrameSource = {
  horizontalScale?: number;
  type: "frames";
  url: string;
};

export type GlyphRasterImageSource = {
  fit?: GlyphRasterFit;
  invert?: boolean;
  type: "image";
  url: string;
};

export type GlyphRasterNoiseSource = {
  seed?: number;
  type: "procedural-noise";
};

export type GlyphRasterSource =
  | GlyphRasterFrameSource
  | GlyphRasterImageSource
  | GlyphRasterNoiseSource;

export type GlyphRasterProps = {
  backgroundColor?: string;
  cellHeight?: number;
  cellWidth?: number;
  characters?: string;
  colors?: string[];
  fps?: number;
  fontSize?: number;
  layout?: GlyphRasterLayout;
  opacity?: number;
  source?: GlyphRasterSource;
  speed?: number;
  variant?: GlyphRasterVariant;
};

type SourceAdapter = {
  defaultFps?: number;
  frameCount?: number;
  getBrightness: (
    col: number,
    row: number,
    cols: number,
    rows: number,
    time: number,
    frame: number,
  ) => number;
  resize?: (cols: number, rows: number) => void;
};

const GLYPH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
const GLYPH_COLORS = ["#2e2e2e", "#585858", "#8a8a8a", "#d0d0d0", "#f4f4f4"];
const NOISE_COLORS = ["#3a3a3a", "#565656", "#737373", "#9a9a9a", "#c8c8c8"];
const GLYPH_FONT_FAMILY = 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif';
const GLYPH_HORIZONTAL_SCALE = 1.09;
const NOISE_CELL_WIDTH = 8;
const NOISE_CELL_HEIGHT = 14;
const NOISE_FONT_SIZE = 13;
const DEFAULT_FRAME_RATE = 18;
const MIN_FRAME_RATE = 1;
const MAX_FRAME_RATE = 60;
const MIN_SPEED = 0.01;
const MAX_SPEED = 4;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const fade = (value: number): number => value * value * value * (value * (value * 6 - 15) + 10);

const lerp = (start: number, end: number, amount: number): number => start + (end - start) * amount;

const hash = (x: number, y: number, seed: number): number => {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);

  return (value ^ (value >>> 16)) >>> 0;
};

const gradient = (x: number, y: number, seed: number, dx: number, dy: number): number => {
  const angle = (hash(x, y, seed) / 0xffffffff) * Math.PI * 2;

  return Math.cos(angle) * dx + Math.sin(angle) * dy;
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
  let amplitude = 0.52;
  let frequency = 1;
  let total = 0;
  let range = 0;

  for (let octave = 0; octave < 4; octave += 1) {
    total += perlin(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    range += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / range;
};

const smoothstep = (edgeStart: number, edgeEnd: number, value: number): number => {
  const amount = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);

  return amount * amount * (3 - 2 * amount);
};

const solarSurfaceBrightness = (col: number, row: number, time: number, seed: number): number => {
  const seconds = time / 1000;
  const x = col * 0.075;
  const y = row * 0.075;
  const convection = fractalNoise(
    x * 0.55 + seconds * 0.035,
    y * 0.55 - seconds * 0.025,
    seed + 211,
  );
  const shear = fractalNoise(x * 0.32 - seconds * 0.02, y * 0.32 + seconds * 0.03, seed + 353);
  const displacement = convection * 2.8;
  const flowX = x + displacement + Math.sin(y * 1.3 + seconds * 0.45 + shear * 2.4) * 0.7;
  const flowY = y + shear * 2.2 + Math.cos(x * 1.1 - seconds * 0.38 + convection * 2.1) * 0.6;
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
  const pulse = 0.5 + Math.sin(seconds * 0.7 + convection * 3.2 + shear * 2.4) * 0.08;

  return clamp(0.22 + (cells * 0.5 + filaments * 0.28 + (convection + 1) * 0.11) * pulse, 0, 1);
};

const resolveSource = (
  source: GlyphRasterSource | undefined,
  variant: GlyphRasterVariant | undefined,
): GlyphRasterSource => {
  if (source) return source;

  if (variant === "eye") {
    return { type: "frames", url: "/terminal-splash.frames" };
  }

  return { type: "procedural-noise" };
};

const createNoiseAdapter = (source: GlyphRasterNoiseSource): SourceAdapter => {
  const seed = source.seed ?? Math.floor(Math.random() * 0xffffffff);

  return {
    defaultFps: DEFAULT_FRAME_RATE,
    getBrightness: (col, row, _cols, _rows, time) => solarSurfaceBrightness(col, row, time, seed),
  };
};

const createFramesAdapter = async (source: GlyphRasterFrameSource): Promise<SourceAdapter> => {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Unable to load character animation frames from ${source.url}.`);
  }

  const raw = new Uint8Array(await response.arrayBuffer());
  const headerEnd = raw.indexOf(10);

  if (headerEnd < 0) {
    throw new Error(`Unable to parse character animation frames from ${source.url}.`);
  }

  const header = JSON.parse(new TextDecoder().decode(raw.subarray(0, headerEnd))) as {
    cols: number;
    fps?: number;
    n_frames: number;
    rows: number;
  };
  const frames = raw.subarray(headerEnd + 1);
  const frameSize = header.cols * header.rows;
  const horizontalScale = source.horizontalScale ?? GLYPH_HORIZONTAL_SCALE;

  return {
    defaultFps: header.fps ?? DEFAULT_FRAME_RATE,
    frameCount: header.n_frames,
    getBrightness: (col, row, cols, rows, _time, frame) => {
      const frameOffset = Math.floor(frame) * frameSize;
      const sourceWidth = header.cols / horizontalScale;
      const sourceStart = (header.cols - sourceWidth) / 2;
      const sourceRow = Math.min(header.rows - 1, Math.floor(((row + 0.5) * header.rows) / rows));
      const sourceCol = Math.min(
        header.cols - 1,
        Math.max(0, Math.floor(sourceStart + ((col + 0.5) * sourceWidth) / cols)),
      );

      return frames[frameOffset + sourceRow * header.cols + sourceCol] / 255;
    },
  };
};

const loadImage = async (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load character animation image ${url}.`));
    image.src = url;
  });

const createImageAdapter = async (source: GlyphRasterImageSource): Promise<SourceAdapter> => {
  const image = await loadImage(source.url);
  const imageCanvas = document.createElement("canvas");
  const imageContext = imageCanvas.getContext("2d", { willReadFrequently: true });
  let brightnessGrid = new Float32Array();

  if (!imageContext) {
    throw new Error(`Unable to read character animation image ${source.url}.`);
  }

  imageCanvas.width = image.naturalWidth;
  imageCanvas.height = image.naturalHeight;
  imageContext.drawImage(image, 0, 0);

  const imageData = imageContext.getImageData(0, 0, imageCanvas.width, imageCanvas.height).data;

  return {
    getBrightness: (col, row, cols) => brightnessGrid[row * cols + col] ?? 0,
    resize: (cols, rows) => {
      const fit = source.fit ?? "cover";
      const sourceAspect = imageCanvas.width / imageCanvas.height;
      const targetAspect = cols / rows;
      const shouldMatchTargetWidth =
        fit === "cover" ? sourceAspect < targetAspect : sourceAspect >= targetAspect;
      const drawWidth = shouldMatchTargetWidth ? cols : rows * sourceAspect;
      const drawHeight = drawWidth / sourceAspect;
      const drawX = (cols - drawWidth) / 2;
      const drawY = (rows - drawHeight) / 2;

      brightnessGrid = new Float32Array(cols * rows);

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const u = (col + 0.5 - drawX) / drawWidth;
          const v = (row + 0.5 - drawY) / drawHeight;

          if (u < 0 || u > 1 || v < 0 || v > 1) continue;

          const sourceX = clamp(Math.floor(u * imageCanvas.width), 0, imageCanvas.width - 1);
          const sourceY = clamp(Math.floor(v * imageCanvas.height), 0, imageCanvas.height - 1);
          const index = (sourceY * imageCanvas.width + sourceX) * 4;
          const alpha = imageData[index + 3] / 255;
          const brightness =
            ((imageData[index] * 0.2126 +
              imageData[index + 1] * 0.7152 +
              imageData[index + 2] * 0.0722) /
              255) *
            alpha;

          brightnessGrid[row * cols + col] = source.invert ? 1 - brightness : brightness;
        }
      }
    },
  };
};

const createSourceAdapter = async (source: GlyphRasterSource): Promise<SourceAdapter> => {
  if (source.type === "frames") return createFramesAdapter(source);
  if (source.type === "image") return createImageAdapter(source);

  return createNoiseAdapter(source);
};

const shouldRefreshCharacter = (brightness: number, source: GlyphRasterSource): boolean => {
  if (source.type === "frames") {
    return (
      (brightness > 0.5 && Math.random() < 0.35) ||
      (brightness > 0.2 && Math.random() < 0.06) ||
      Math.random() < 0.008
    );
  }

  if (source.type === "image") {
    return (
      (brightness > 0.55 && Math.random() < 0.16) ||
      (brightness > 0.25 && Math.random() < 0.06) ||
      Math.random() < 0.01
    );
  }

  return (
    (brightness > 0.58 && Math.random() < 0.22) ||
    (brightness > 0.32 && Math.random() < 0.06) ||
    Math.random() < 0.012
  );
};

export const GlyphRaster = component$(
  ({
    backgroundColor = "#050505",
    cellHeight = NOISE_CELL_HEIGHT,
    cellWidth = NOISE_CELL_WIDTH,
    characters = GLYPH_CHARS,
    colors,
    fps,
    fontSize = NOISE_FONT_SIZE,
    layout = "fixed",
    opacity,
    source,
    speed = 1,
    variant,
  }: GlyphRasterProps): QwikJSX.Element => {
    const rasterId = useId();
    const resolvedSource = resolveSource(source, variant);
    const resolvedCharacters = characters.length > 0 ? characters : GLYPH_CHARS;
    const resolvedColors =
      colors && colors.length > 0
        ? colors
        : resolvedSource.type === "procedural-noise"
          ? NOISE_COLORS
          : GLYPH_COLORS;
    const resolvedSpeed = clamp(speed, MIN_SPEED, MAX_SPEED);
    const resolvedOpacity =
      opacity ?? (resolvedSource.type === "frames" || variant === "eye" ? 0.22 : 0.32);
    const style = `--glyph-raster-opacity: ${resolvedOpacity}; --glyph-raster-color: ${backgroundColor};`;

    useStylesScoped$(styles);

    useVisibleTask$(async ({ cleanup }): Promise<void> => {
      const canvas = document.getElementById(rasterId) as HTMLCanvasElement | null;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      let animationFrame = 0;
      let isCleanedUp = false;
      let removeResize = (): void => {};

      cleanup(() => {
        isCleanedUp = true;
        cancelAnimationFrame(animationFrame);
        removeResize();
      });

      const adapter = await createSourceAdapter(resolvedSource);
      if (isCleanedUp) return;

      let cols = 0;
      let rows = 0;
      let grid: string[] = [];
      let framePosition = 0;
      let lastFrameAt = 0;

      const randomCharacter = (): string =>
        resolvedCharacters[Math.floor(Math.random() * resolvedCharacters.length)];

      const scheduleRender = (): void => {
        if (animationFrame !== 0 || isCleanedUp) return;

        animationFrame = requestAnimationFrame(render);
      };

      const resize = (): void => {
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * pixelRatio;
        canvas.height = canvas.clientHeight * pixelRatio;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        cols = Math.max(1, Math.ceil(canvas.clientWidth / cellWidth));
        rows = Math.max(1, Math.ceil(canvas.clientHeight / cellHeight));
        grid = Array.from({ length: cols * rows }, randomCharacter);
        adapter.resize?.(cols, rows);
        scheduleRender();
      };

      const render = (time: number): void => {
        animationFrame = 0;

        const frameRate = clamp(
          fps ?? adapter.defaultFps ?? DEFAULT_FRAME_RATE,
          MIN_FRAME_RATE,
          MAX_FRAME_RATE,
        );

        if (time - lastFrameAt < 1000 / frameRate) {
          scheduleRender();
          return;
        }

        const elapsedFrames = lastFrameAt === 0 ? 1 : ((time - lastFrameAt) / 1000) * frameRate;
        const currentFrame = adapter.frameCount
          ? Math.floor(framePosition) % adapter.frameCount
          : 0;
        const offsetX = (canvas.clientWidth - cols * cellWidth) / 2;
        const offsetY = (canvas.clientHeight - rows * cellHeight) / 2;

        lastFrameAt = time;

        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        context.font = `${fontSize}px ${GLYPH_FONT_FAMILY}`;
        context.textBaseline = "top";

        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const index = row * cols + col;
            const brightness = adapter.getBrightness(
              col,
              row,
              cols,
              rows,
              time * resolvedSpeed,
              currentFrame,
            );

            if (shouldRefreshCharacter(brightness, resolvedSource)) {
              grid[index] = randomCharacter();
            }

            context.fillStyle =
              resolvedColors[
                Math.min(resolvedColors.length - 1, Math.floor(brightness * resolvedColors.length))
              ];
            context.fillText(grid[index], offsetX + col * cellWidth, offsetY + row * cellHeight);
          }
        }

        if (adapter.frameCount) {
          framePosition = (framePosition + elapsedFrames * resolvedSpeed) % adapter.frameCount;
        }

        scheduleRender();
      };

      resize();
      window.addEventListener("resize", resize);
      removeResize = () => window.removeEventListener("resize", resize);
    });

    return (
      <canvas
        id={rasterId}
        class={`glyph-raster glyph-raster--${layout} glyph-raster--${resolvedSource.type}`}
        style={style}
        aria-hidden="true"
      />
    );
  },
);
