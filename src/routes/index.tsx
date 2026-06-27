import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHeadValue } from "@builder.io/qwik-city";
import { type DocumentHead } from "@builder.io/qwik-city";
import TypeIt from "typeit";

import { createPageMetaTags } from "src/helpers/meta";
import styles from "src/routes/index.scss?inline";

const SPLASH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
const SPLASH_COLORS = ["#2e2e2e", "#585858", "#8a8a8a", "#d0d0d0", "#f4f4f4"];
const SPLASH_FONT_FAMILY =
  'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace';
const SPLASH_HORIZONTAL_SCALE = 1.09;

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  useVisibleTask$(({ cleanup }): void => {
    const continueToHome = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.code !== "Enter") return;

      window.location.assign("/home/");
    };

    window.addEventListener("keydown", continueToHome, { capture: true });

    cleanup(() => {
      window.removeEventListener("keydown", continueToHome, { capture: true });
    });
  });

  useVisibleTask$(({ cleanup }): void => {
    const typeIt = new TypeIt("#homepage-title", {
      loop: true,
      startDelay: 6000,
      startDelete: true,
    });

    typeIt
      .delete()
      .pause(1200)
      .type("Don't be shy")
      .pause(1000)
      .type(".")
      .pause(800)
      .type(".")
      .pause(800)
      .type(".")
      .pause(6000)
      .delete()
      .pause(3000)
      .type("Hey there, I'm")
      .pause(800)
      .type(" ")
      .pause(400)
      .type("Daniel", { instant: true })
      .pause(300)
      .type(".")
      .pause(10000)
      .go();

    cleanup(() => {
      typeIt.destroy();
    });
  });

  useVisibleTask$(async ({ cleanup }): Promise<void> => {
    const canvas = document.getElementById("homepage-splash") as HTMLCanvasElement | null;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

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
        const sourceRow = Math.min(header.rows - 1, Math.floor(((row + 0.5) * header.rows) / rows));
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
    <section class="homepage-splash-stage">
      <canvas id="homepage-splash" aria-hidden="true" />
      <div id="homepage-splash-overlay" aria-hidden="true" />
      <h2 id="homepage-title">Hey there, I'm Daniel.</h2>
      <strong>press enter to continue</strong>
    </section>
  );
});

export const head: DocumentHead = (): DocumentHeadValue => {
  const title = "Daniel van Dijk";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { meta: createPageMetaTags({ description, title }), title };
};
