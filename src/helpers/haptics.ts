// Press-and-hold haptics with two backends: the standard Vibration API
// (Android), and switch-style checkboxes for iOS, which has no Vibration API
// but where Safari 17.4+ plays a system haptic tick whenever a switch input
// toggles. Current iOS only honors toggles from a real touch (programmatic
// clicks toggle silently), so the switch backend both clicks a hidden switch
// (for older iOS) and overlays an invisible full-viewport switch that the
// holding finger toggles natively on release. The switch trick is
// unofficial; if Apple closes it, the ticks silently stop while everything
// else keeps working.

export type HoldHaptics = {
  confirm: () => void;
  dispose: () => void;
  start: () => void;
  stop: () => void;
};

const VIBRATION_PULSE_COUNT = 10;
const CONFIRM_VIBRATION_MS = 90;
const CONFIRM_TICK_GAP_MS = 90;
const TICK_START_INTERVAL_MS = 200;
const TICK_END_INTERVAL_MS = 70;

// The Vibration API has no intensity control, so the building "charge-up"
// feel while holding is approximated with pulses that lengthen as the hold
// progresses.
const createHoldVibrationPattern = (durationMs: number): number[] => {
  const pattern: number[] = [];
  const intervalMs = durationMs / VIBRATION_PULSE_COUNT;

  for (let pulse = 0; pulse < VIBRATION_PULSE_COUNT; pulse += 1) {
    const onMs = Math.round(10 + ((pulse + 1) / VIBRATION_PULSE_COUNT) * 50);

    pattern.push(onMs, Math.max(0, Math.round(intervalMs - onMs)));
  }

  return pattern;
};

const createVibrationHoldHaptics = (rampDurationMs: number): HoldHaptics => {
  const pattern = createHoldVibrationPattern(rampDurationMs);

  return {
    confirm: (): void => void navigator.vibrate(CONFIRM_VIBRATION_MS),
    dispose: (): void => void navigator.vibrate(0),
    start: (): void => void navigator.vibrate(pattern),
    stop: (): void => void navigator.vibrate(0),
  };
};

// The switch tick has a fixed strength, so the charge-up is approximated by
// ticking faster as the hold progresses instead.
const createSwitchHoldHaptics = (rampDurationMs: number): HoldHaptics => {
  const container = document.createElement("label");
  const input = document.createElement("input");

  // The switch must stay rendered for its toggle haptic to play (with
  // display: none it toggles silently), so it is hidden as a transparent
  // 1px box in a corner instead.
  Object.assign(container.style, {
    insetBlockEnd: "0",
    insetInlineStart: "0",
    opacity: "0",
    overflow: "hidden",
    blockSize: "1px",
    inlineSize: "1px",
    padding: "0",
    pointerEvents: "none",
    position: "fixed",
    zIndex: "-1",
  });
  container.ariaHidden = "true";
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  // Escape any global input styling so the control keeps its native switch
  // rendering, which is what the toggle haptic is tied to.
  input.style.all = "initial";
  input.style.appearance = "auto";
  container.append(input);
  document.body.append(container);

  // The overlay switch receives the user's actual press, so lifting the
  // finger toggles it natively — the one interaction current iOS still plays
  // a haptic for. It sits above the page but stays invisible; pointer events
  // bubble through to the window listeners driving the hold.
  const overlay = document.createElement("input");

  overlay.type = "checkbox";
  overlay.setAttribute("switch", "");
  overlay.tabIndex = -1;
  overlay.ariaHidden = "true";
  Object.assign(overlay.style, {
    cursor: "default",
    height: "100%",
    left: "0",
    margin: "0",
    opacity: "0",
    position: "fixed",
    top: "0",
    touchAction: "manipulation",
    width: "100%",
    zIndex: "9999",
  });
  document.body.append(overlay);

  let tickTimeout = 0;
  let confirmTimeout = 0;
  let startedAt = 0;

  const tick = (): void => container.click();

  const stopTicking = (): void => {
    window.clearTimeout(tickTimeout);
    tickTimeout = 0;
  };

  const scheduleNextTick = (): void => {
    const progress = Math.min(1, (Date.now() - startedAt) / rampDurationMs);
    const intervalMs =
      TICK_START_INTERVAL_MS + (TICK_END_INTERVAL_MS - TICK_START_INTERVAL_MS) * progress;

    tickTimeout = window.setTimeout((): void => {
      tick();
      scheduleNextTick();
    }, intervalMs);
  };

  return {
    confirm: (): void => {
      stopTicking();
      tick();
      confirmTimeout = window.setTimeout(tick, CONFIRM_TICK_GAP_MS);
    },
    dispose: (): void => {
      stopTicking();
      window.clearTimeout(confirmTimeout);
      container.remove();
      overlay.remove();
    },
    start: (): void => {
      stopTicking();
      startedAt = Date.now();
      tick();
      scheduleNextTick();
    },
    stop: stopTicking,
  };
};

export const createHoldHaptics = (rampDurationMs: number): HoldHaptics => {
  if (typeof navigator.vibrate === "function") {
    return createVibrationHoldHaptics(rampDurationMs);
  }

  // Switch-toggle haptic support cannot be feature-detected, so the hidden
  // switch is used whenever the Vibration API is missing; on browsers without
  // the haptic it just toggles an invisible checkbox.
  return createSwitchHoldHaptics(rampDurationMs);
};
