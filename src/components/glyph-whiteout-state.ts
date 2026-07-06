// Shared between page-transition gestures and the glyph rasters so every
// glyph cell can be lifted toward full brightness. Brighter glyphs also churn
// faster, so the whole field speeds up as it whitens. Module state (rather
// than component state) lets a fade started on one page finish on the next,
// since the noise raster in the root layout persists across navigations.
let glyphWhiteout = 0;
let animationFrame = 0;
let resolveActiveAnimation: ((didComplete: boolean) => void) | null = null;

const easeInOut = (amount: number): number => amount * amount * (3 - 2 * amount);

export const getGlyphWhiteout = (): number => glyphWhiteout;

// Animates the whiteout toward `target`, scaling `fullRangeDurationMs` by the
// distance left to travel so partial fades keep the same speed. Resolves true
// when the target is reached, or false when superseded by a newer animation.
export const animateGlyphWhiteout = (
  target: number,
  fullRangeDurationMs: number,
): Promise<boolean> => {
  const clampedTarget = Math.min(1, Math.max(0, target));

  if (animationFrame !== 0) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  resolveActiveAnimation?.(false);
  resolveActiveAnimation = null;

  const start = glyphWhiteout;
  const durationMs = fullRangeDurationMs * Math.abs(clampedTarget - start);

  if (durationMs <= 0) {
    glyphWhiteout = clampedTarget;
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let startedAt = 0;

    resolveActiveAnimation = resolve;

    const step = (time: number): void => {
      if (startedAt === 0) {
        startedAt = time;
      }

      const progress = Math.min(1, (time - startedAt) / durationMs);

      glyphWhiteout = start + (clampedTarget - start) * easeInOut(progress);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      animationFrame = 0;
      resolveActiveAnimation = null;
      resolve(true);
    };

    animationFrame = requestAnimationFrame(step);
  });
};
