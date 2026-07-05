import type { QwikJSX } from "@builder.io/qwik";
import { component$, useSignal, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";

import { setElasticOverscrollOffset } from "src/components/elastic-overscroll-state";
import styles from "src/components/elastic-overscroll.scss?inline";

const MAX_DISTANCE = 128;
const WHEEL_RESISTANCE = 0.58;
const TOUCH_RESISTANCE = 0.86;
const SPRING_DECAY = 0.84;
const SETTLED_DISTANCE = 0.35;
// Wheel input has no release event, so the spring-back fires this long after
// the last wheel delta; generous enough that holding still against the edge
// (which emits no events) does not read as a release.
const WHEEL_RELEASE_DELAY = 600;
// The edge stays completely rigid until sustained scrolling breaks through
// it: nothing moves below the pressure threshold, pressure builds at a
// capped rate (so the size of a flick's deltas cannot matter, only time
// spent actively pushing), and wheel streams classified as momentum coasting
// never charge the wall — they only bleed pressure back off. Past the
// threshold, further pull converts into distance with a gain, so revealing
// moves noticeably easier than breaking through did.
const PRESSURE_THRESHOLD = 70;
const PRESSURE_CHARGE_RATE = 0.5;
const PRESSURE_LEAK_RATE = 0.08;
const PRESSURE_COAST_DRAIN_RATE = 0.15;
const PRESSURE_SAMPLE_MS = 32;
const POST_THRESHOLD_GAIN = 1.7;
// Momentum coasting after a flick emits a dense stream of deltas that never
// rise (they decay or plateau): this many non-rising deltas in a row
// classify the stream as coasting, and a delta must exceed the previous one
// by this ratio to count as finger-driven again. Events further apart than
// the impulse gap are separate impulses (e.g. discrete wheel notches), never
// coasting.
const WHEEL_COAST_AFTER_DECAYS = 4;
const WHEEL_DRIVE_RATIO = 1.3;
const WHEEL_IMPULSE_GAP_MS = 50;
const MAX_PRESSURE = PRESSURE_THRESHOLD + MAX_DISTANCE / POST_THRESHOLD_GAIN;

const clampElasticPressure = (pressure: number): number => {
  return Math.max(-MAX_PRESSURE, Math.min(MAX_PRESSURE, pressure));
};

const distanceFromPressure = (pressure: number): number => {
  const givenIn = Math.max(0, Math.abs(pressure) - PRESSURE_THRESHOLD) * POST_THRESHOLD_GAIN;

  return Math.sign(pressure) * Math.min(MAX_DISTANCE, givenIn);
};

const getScrollLimit = (): number => {
  const root = document.documentElement;
  return Math.max(0, root.scrollHeight - window.innerHeight);
};

const isAtTop = (): boolean => window.scrollY <= 0;
const isAtBottom = (): boolean => window.scrollY >= getScrollLimit() - 1;

export const ElasticOverscroll = component$((): QwikJSX.Element => {
  const element = useSignal<HTMLDivElement>();

  useStylesScoped$(styles);

  useVisibleTask$(({ cleanup }): void => {
    const overlay = element.value;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!overlay || prefersReducedMotion) return;

    const root = document.documentElement;
    let pressure = 0;
    let lastPullAt = 0;
    let lastTouchY: number | undefined;
    let lastWheelMagnitude = 0;
    let lastWheelAt = 0;
    let wheelDecayStreak = 0;
    let isWheelCoasting = false;
    let animationFrame = 0;
    let wheelReleaseTimeout: ReturnType<typeof setTimeout> | undefined;

    const renderDistance = (): void => {
      const distance = distanceFromPressure(pressure);
      const topDistance = Math.max(0, distance);
      const bottomDistance = Math.max(0, -distance);

      overlay.style.setProperty("--elastic-overscroll-top", topDistance.toFixed(2));
      overlay.style.setProperty("--elastic-overscroll-bottom", bottomDistance.toFixed(2));
      root.style.setProperty("--elastic-overscroll-offset", `${distance.toFixed(2)}px`);
      setElasticOverscrollOffset(distance);
    };

    const stopSpring = (): void => {
      if (!animationFrame) return;

      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const scheduleWheelRelease = (): void => {
      if (wheelReleaseTimeout) clearTimeout(wheelReleaseTimeout);

      wheelReleaseTimeout = setTimeout((): void => {
        wheelReleaseTimeout = undefined;
        release();
      }, WHEEL_RELEASE_DELAY);
    };

    const release = (): void => {
      stopSpring();

      const tick = (): void => {
        pressure *= SPRING_DECAY;

        if (Math.abs(distanceFromPressure(pressure)) <= SETTLED_DISTANCE) {
          pressure = 0;
          animationFrame = 0;
          renderDistance();
          return;
        }

        renderDistance();
        animationFrame = requestAnimationFrame(tick);
      };

      animationFrame = requestAnimationFrame(tick);
    };

    const pull = (delta: number, isCoasting = false): void => {
      stopSpring();

      const now = performance.now();
      const elapsed = Math.min(PRESSURE_SAMPLE_MS, now - lastPullAt);
      lastPullAt = now;

      let next = pressure + delta;

      // While the wall holds, only actively driven input charges it, at a
      // rate-limited pace; coasting momentum bleeds pressure back off. Pulls
      // that back off pass through unmodified.
      if (Math.abs(pressure) < PRESSURE_THRESHOLD && Math.abs(next) > Math.abs(pressure)) {
        if (isCoasting) {
          next =
            Math.sign(next) * Math.max(0, Math.abs(pressure) - PRESSURE_COAST_DRAIN_RATE * elapsed);
        } else {
          const gain = Math.abs(next) - Math.abs(pressure);
          const cappedGain = Math.min(gain, PRESSURE_CHARGE_RATE * elapsed);
          const leakedGain = Math.max(0, cappedGain - PRESSURE_LEAK_RATE * elapsed);

          next = Math.sign(next) * (Math.abs(pressure) + leakedGain);
        }
      }

      pressure = clampElasticPressure(next);
      renderDistance();
    };

    // Classifies every wheel event (not just those at an edge) so a flick's
    // momentum is already known to be coasting by the time it reaches the
    // edge.
    const classifyWheelCoasting = (magnitude: number): boolean => {
      const now = performance.now();
      const isSeparateImpulse = now - lastWheelAt > WHEEL_IMPULSE_GAP_MS;
      const isRising = magnitude > lastWheelMagnitude * (isWheelCoasting ? WHEEL_DRIVE_RATIO : 1);

      lastWheelAt = now;
      lastWheelMagnitude = magnitude;

      if (isSeparateImpulse || isRising) {
        wheelDecayStreak = 0;
        isWheelCoasting = false;
      } else {
        wheelDecayStreak += 1;

        if (wheelDecayStreak >= WHEEL_COAST_AFTER_DECAYS) {
          isWheelCoasting = true;
        }
      }

      return isWheelCoasting;
    };

    const onWheel = (event: WheelEvent): void => {
      const isCoasting = classifyWheelCoasting(Math.abs(event.deltaY));

      if (event.deltaY < 0 && isAtTop()) {
        pull(-event.deltaY * WHEEL_RESISTANCE, isCoasting);
        scheduleWheelRelease();
        return;
      }

      if (event.deltaY > 0 && isAtBottom()) {
        pull(-event.deltaY * WHEEL_RESISTANCE, isCoasting);
        scheduleWheelRelease();
      }
    };

    const onTouchStart = (event: TouchEvent): void => {
      lastTouchY = event.touches[0]?.clientY;
    };

    const onTouchMove = (event: TouchEvent): void => {
      const touchY = event.touches[0]?.clientY;

      if (touchY === undefined || lastTouchY === undefined) return;

      const deltaY = touchY - lastTouchY;
      lastTouchY = touchY;

      if (deltaY > 0 && isAtTop()) {
        pull(deltaY * TOUCH_RESISTANCE);
        return;
      }

      if (deltaY < 0 && isAtBottom()) {
        pull(deltaY * TOUCH_RESISTANCE);
      }
    };

    const onTouchEnd = (): void => {
      lastTouchY = undefined;
      release();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    cleanup((): void => {
      stopSpring();
      if (wheelReleaseTimeout) clearTimeout(wheelReleaseTimeout);
      root.style.removeProperty("--elastic-overscroll-offset");
      setElasticOverscrollOffset(0);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("touchend", onTouchEnd);
    });
  });

  return (
    <div aria-hidden="true" class="elastic-overscroll" ref={element}>
      <p class="elastic-overscroll__text elastic-overscroll__text--top">Nothing above but noise.</p>
      <p class="elastic-overscroll__text elastic-overscroll__text--bottom">
        Nothing below but noise.
      </p>
    </div>
  );
});
