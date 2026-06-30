import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";

import styles from "src/components/splash-background.scss?inline";

type SplashBackgroundVariant = "eye" | "noise";

type SplashBackgroundProps = {
  variant?: SplashBackgroundVariant;
};

const SPLASH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
const SPLASH_COLORS = ["#2e2e2e", "#585858", "#8a8a8a", "#d0d0d0", "#f4f4f4"];
const NOISE_COLORS = ["#3a3a3a", "#565656", "#737373", "#9a9a9a", "#c8c8c8"];
const SPLASH_FONT_FAMILY = 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif';
const SPLASH_HORIZONTAL_SCALE = 1.09;
const NOISE_CELL_WIDTH = 8;
const NOISE_CELL_HEIGHT = 14;
const NOISE_FONT_SIZE = 13;

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

export const SplashBackground = component$(
  ({ variant = "noise" }: SplashBackgroundProps): QwikJSX.Element => {
    const splashId = `splash-background-${Math.random().toString(36).slice(2)}`;

    useStylesScoped$(styles);

    useVisibleTask$(async ({ cleanup }): Promise<void> => {
      const canvas = document.getElementById(splashId) as HTMLCanvasElement | null;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      if (variant === "noise") {
        const seed = Math.floor(Math.random() * 0xffffffff);
        let cols = 0;
        let rows = 0;
        let grid: string[] = [];
        let animationFrame = 0;
        let lastFrameAt = 0;

        const resize = (): void => {
          const pixelRatio = window.devicePixelRatio || 1;
          canvas.width = canvas.clientWidth * pixelRatio;
          canvas.height = canvas.clientHeight * pixelRatio;
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

          cols = Math.max(1, Math.ceil(canvas.clientWidth / NOISE_CELL_WIDTH));
          rows = Math.max(1, Math.ceil(canvas.clientHeight / NOISE_CELL_HEIGHT));
          grid = Array.from(
            { length: cols * rows },
            () => SPLASH_CHARS[Math.floor(Math.random() * SPLASH_CHARS.length)],
          );
        };

        const render = (time: number): void => {
          if (time - lastFrameAt < 1000 / 18) {
            animationFrame = requestAnimationFrame(render);
            return;
          }
          lastFrameAt = time;

          const offsetX = (canvas.clientWidth - cols * NOISE_CELL_WIDTH) / 2;
          const offsetY = (canvas.clientHeight - rows * NOISE_CELL_HEIGHT) / 2;
          context.fillStyle = "#050505";
          context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
          context.font = `${NOISE_FONT_SIZE}px ${SPLASH_FONT_FAMILY}`;
          context.textBaseline = "top";

          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const index = row * cols + col;
              const brightness = solarSurfaceBrightness(col, row, time, seed);

              if (
                (brightness > 0.58 && Math.random() < 0.22) ||
                (brightness > 0.32 && Math.random() < 0.06) ||
                Math.random() < 0.012
              ) {
                grid[index] = SPLASH_CHARS[Math.floor(Math.random() * SPLASH_CHARS.length)];
              }

              context.fillStyle =
                NOISE_COLORS[
                  Math.min(NOISE_COLORS.length - 1, Math.floor(brightness * NOISE_COLORS.length))
                ];
              context.fillText(
                grid[index],
                offsetX + col * NOISE_CELL_WIDTH,
                offsetY + row * NOISE_CELL_HEIGHT,
              );
            }
          }

          animationFrame = requestAnimationFrame(render);
        };

        resize();
        window.addEventListener("resize", resize);
        animationFrame = requestAnimationFrame(render);

        cleanup(() => {
          cancelAnimationFrame(animationFrame);
          window.removeEventListener("resize", resize);
        });

        return;
      }

      const response = await fetch("/terminal-splash.frames");
      const raw = new Uint8Array(await response.arrayBuffer());
      const headerEnd = raw.indexOf(10);
      if (headerEnd < 0) return;

      const header = JSON.parse(new TextDecoder().decode(raw.subarray(0, headerEnd))) as {
        cols: number;
        fps?: number;
        n_frames: number;
        rows: number;
      };
      const frames = raw.subarray(headerEnd + 1);
      const frameSize = header.cols * header.rows;
      const fontSize = 13;
      const cellWidth = 8;
      const cellHeight = 14;
      let cols = 0;
      let rows = 0;
      let grid: string[] = [];
      let frameIndex = 0;
      let animationFrame = 0;
      let lastFrameAt = 0;

      const resize = (): void => {
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

        cols = Math.max(1, Math.ceil(canvas.clientWidth / cellWidth));
        rows = Math.max(1, Math.ceil(canvas.clientHeight / cellHeight));
        grid = Array.from(
          { length: cols * rows },
          () => SPLASH_CHARS[Math.floor(Math.random() * SPLASH_CHARS.length)],
        );
      };

      const render = (time: number): void => {
        if (time - lastFrameAt < 1000 / (header.fps ?? 18)) {
          animationFrame = requestAnimationFrame(render);
          return;
        }
        lastFrameAt = time;

        const frameOffset = frameIndex * frameSize;
        const offsetX = (canvas.clientWidth - cols * cellWidth) / 2;
        const offsetY = (canvas.clientHeight - rows * cellHeight) / 2;
        const sourceWidth = header.cols / SPLASH_HORIZONTAL_SCALE;
        const sourceStart = (header.cols - sourceWidth) / 2;

        context.fillStyle = "#050505";
        context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        context.font = `${fontSize}px ${SPLASH_FONT_FAMILY}`;
        context.textBaseline = "top";

        for (let row = 0; row < rows; row += 1) {
          const sourceRow = Math.min(
            header.rows - 1,
            Math.floor(((row + 0.5) * header.rows) / rows),
          );
          for (let col = 0; col < cols; col += 1) {
            const index = row * cols + col;
            const sourceCol = Math.min(
              header.cols - 1,
              Math.max(0, Math.floor(sourceStart + ((col + 0.5) * sourceWidth) / cols)),
            );
            const brightness = frames[frameOffset + sourceRow * header.cols + sourceCol] / 255;

            if (
              (brightness > 0.5 && Math.random() < 0.35) ||
              (brightness > 0.2 && Math.random() < 0.06) ||
              Math.random() < 0.008
            ) {
              grid[index] = SPLASH_CHARS[Math.floor(Math.random() * SPLASH_CHARS.length)];
            }

            context.fillStyle =
              SPLASH_COLORS[
                Math.min(SPLASH_COLORS.length - 1, Math.floor(brightness * SPLASH_COLORS.length))
              ];
            context.fillText(grid[index], offsetX + col * cellWidth, offsetY + row * cellHeight);
          }
        }

        frameIndex = (frameIndex + 1) % header.n_frames;
        animationFrame = requestAnimationFrame(render);
      };

      resize();
      window.addEventListener("resize", resize);
      animationFrame = requestAnimationFrame(render);

      cleanup(() => {
        cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", resize);
      });
    });

    return (
      <canvas
        id={splashId}
        class={`splash-background splash-background--${variant}`}
        aria-hidden="true"
      />
    );
  },
);
